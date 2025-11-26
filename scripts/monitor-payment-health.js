#!/usr/bin/env node
/**
 * BETRIX Payment Health Monitor
 * Checks mapping misses and payment failures daily, notifies admin
 *
 * Usage: node scripts/monitor-payment-health.js
 * Environment: REDIS_URL, ADMIN_TELEGRAM_ID, TELEGRAM_TOKEN
 */

import Redis from 'ioredis';
import fetch from 'node-fetch';

async function notifyAdmin(message) {
  if (!process.env.ADMIN_TELEGRAM_ID || !process.env.TELEGRAM_TOKEN) {
    console.log('[MONITOR] Admin notification disabled (missing env vars)');
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.ADMIN_TELEGRAM_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error('[MONITOR] Failed to notify admin:', err?.message || err);
  }
}

async function run() {
  console.log('\n📊 BETRIX Payment Health Monitor');
  console.log(`Started: ${new Date().toISOString()}\n`);

  if (!process.env.REDIS_URL) {
    console.error('❌ REDIS_URL not configured');
    process.exit(1);
  }

  const redis = new Redis(process.env.REDIS_URL);

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    console.log(`📅 Checking health for: ${today}`);

    // Check mapping misses
    const missesKey = `monitor:payment:mapping_misses:${today}`;
    const missesYesterdayKey = `monitor:payment:mapping_misses:${yesterday}`;
    const misses = await redis.get(missesKey) || '0';
    const missesYesterday = await redis.get(missesYesterdayKey) || '0';

    console.log(`\n🔍 Mapping Misses:`);
    console.log(`  Today (${today}): ${misses}`);
    console.log(`  Yesterday (${yesterday}): ${missesYesterday}`);

    // Check pending orders (orders created but not yet completed)
    const pendingPattern = 'payment:order:*';
    const pendingOrders = [];
    let cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pendingPattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const orderRaw = await redis.get(key);
        if (orderRaw) {
          try {
            const order = JSON.parse(orderRaw);
            if (order.status === 'pending') {
              const createdAt = new Date(order.createdAt);
              const ageMinutes = Math.floor((Date.now() - createdAt.getTime()) / 60000);
              if (ageMinutes > 15) { // flagged if >15 minutes old
                pendingOrders.push({
                  orderId: order.orderId,
                  userId: order.userId,
                  method: order.paymentMethod,
                  ageMinutes,
                  createdAt: order.createdAt
                });
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    } while (cursor !== '0');

    console.log(`\n⏳ Pending Orders (>15 min old):`);
    if (pendingOrders.length === 0) {
      console.log('  None — all orders timely');
    } else {
      console.log(`  Found ${pendingOrders.length}:`);
      pendingOrders.slice(0, 5).forEach(o => {
        console.log(`    - ${o.orderId} (user ${o.userId}, ${o.method}, ${o.ageMinutes}min old)`);
      });
    }

    // Prepare notification if there are issues
    const hasMisses = parseInt(misses) > 0;
    const hasStalePending = pendingOrders.length > 0;

    if (hasMisses || hasStalePending) {
      let report = '🚨 *Payment Health Alert*\n\n';

      if (hasMisses) {
        report += `⚠️ *Mapping Misses (${today}):* ${misses}\n`;
        const prevCount = parseInt(missesYesterday);
        if (prevCount > 0) {
          const change = ((parseInt(misses) - prevCount) / prevCount * 100).toFixed(0);
          report += `  (Δ ${change}% vs yesterday)\n\n`;
        }
      }

      if (hasStalePending) {
        report += `⏳ *Stale Pending Orders:* ${pendingOrders.length}\n`;
        report += pendingOrders.slice(0, 3).map(o => {
          return `  • ${o.orderId}: user ${o.userId}, ${o.method}, ${o.ageMinutes}min old`;
        }).join('\n') + '\n\n';
      }

      report += `_Check time: ${new Date().toISOString()}_`;

      console.log('\n📨 Sending notification to admin...');
      await notifyAdmin(report);
    } else {
      console.log('\n✅ Payment health is good — no issues found');
    }

    console.log('\n✅ Monitor check complete\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Monitor failed:', err);
    await notifyAdmin(`❌ Payment health monitor error: ${err?.message || String(err)}`);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

run();
