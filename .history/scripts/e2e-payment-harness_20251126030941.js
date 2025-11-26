#!/usr/bin/env node
/**
 * BETRIX e2e Payment Harness (local/sandbox)
 * - Creates a PayPal order via createPaymentOrder (mock or local redis)
 * - Prints the approval URL for manual testing
 * - Optionally simulates capture/activation using verifyAndActivatePayment
 *
 * Usage: node scripts/e2e-payment-harness.js
 */

import readline from 'readline';
import fs from 'fs/promises';
import { createPaymentOrder, verifyAndActivatePayment } from '../src/handlers/payment-router.js';
import Redis from 'ioredis';

class MockRedis {
  constructor() { this.data = {}; }
  async get(k) { return this.data[k] || null; }
  async setex(k, ttl, v) { this.data[k] = v; return 'OK'; }
  async set(k, v) { this.data[k] = v; return 'OK'; }
  async hset(k, field, v) { if (typeof field === 'object') this.data[k] = field; else { this.data[k] = this.data[k]||{}; this.data[k][field]=v;} return 1; }
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function run() {
  console.log('\n🔁 BETRIX E2E Payment Harness');

  const useRealRedis = !!process.env.REDIS_URL;
  const redis = useRealRedis ? new Redis(process.env.REDIS_URL) : new MockRedis();

  const userId = process.env.TEST_USER_ID ? Number(process.env.TEST_USER_ID) : 900900;
  const tier = process.env.TEST_TIER || 'PLUS';
  const method = process.env.TEST_METHOD || 'SAFARICOM_TILL';
  const userRegion = process.env.TEST_REGION || (method === 'PAYPAL' ? 'US' : 'KE');

  console.log(`Using redis: ${useRealRedis ? 'real' : 'mock'}`);
  console.log(`Creating order for user ${userId}, tier ${tier}, method ${method}`);

  const order = await createPaymentOrder(redis, userId, tier, method, userRegion, { phone: '+254700000000' });

  console.log('\nOrder created:');
  console.log(order.orderId, order.providerRef || '', order.metadata || '');

  const checkout = order?.metadata?.checkoutUrl || order?.instructions?.checkoutUrl;
  if (checkout) {
    console.log('\nApproval URL:');
    console.log(checkout);
  } else {
    console.log('\nNo checkout URL available for this provider.');
  }

  // Support non-interactive CI runs via env vars
  const noninteractive = process.env.NONINTERACTIVE === '1' || process.env.CI === 'true';
  const simulateCapture = process.env.SIMULATE_CAPTURE === '1';

  if (noninteractive) {
    if (simulateCapture) {
      const tx = `CI_SIM_TX_${Date.now()}`;
      const res = await verifyAndActivatePayment(redis, order.orderId, tx);
      console.log('\n[CI] Activation result:', res);
    } else {
      console.log('\n[CI] Non-interactive run - skipping capture.');
    }
  } else {
    const doSim = (await prompt('\nSimulate capture & activate now? (y/N): ')).trim().toLowerCase();
    if (doSim === 'y') {
      const tx = `SIM_TX_${Date.now()}`;
      const res = await verifyAndActivatePayment(redis, order.orderId, tx);
      console.log('\nActivation result:', res);
    } else {
      console.log('Skip simulation. Use the approval URL to manually complete payment in sandbox then call capture endpoint.');
    }
  }

  process.exit(0);
}

run().catch(err => { console.error('E2E harness failed', err); process.exit(1); });
