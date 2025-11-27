#!/usr/bin/env node
/*
  Manage Telegram webhook from local environment variables.
  Usage:
    node scripts/manage-telegram-webhook.js set    # registers webhook using WEBHOOK_URL and WEBHOOK_SECRET
    node scripts/manage-telegram-webhook.js get    # prints getWebhookInfo
    node scripts/manage-telegram-webhook.js delete # deletes webhook

  IMPORTANT: Do NOT commit secrets. Run this locally and keep your env secure.
*/

import { TelegramService } from '../src/services/telegram.js';

function envOrFail(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return v;
}

async function run() {
  const cmd = (process.argv[2] || '').toLowerCase();
  if (!['set', 'get', 'delete'].includes(cmd)) {
    console.error('Usage: node scripts/manage-telegram-webhook.js <set|get|delete>');
    process.exit(1);
  }

  const token = envOrFail('TELEGRAM_TOKEN') || envOrFail('TELEGRAM_BOT_TOKEN');
  const webhookUrl = process.env.WEBHOOK_URL || process.env.TELEGRAM_WEBHOOK_URL;
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || null;

  const tg = new TelegramService(token, parseInt(process.env.TELEGRAM_SAFE_CHUNK || '2000', 10));

  try {
    if (cmd === 'set') {
      if (!webhookUrl) {
        console.error('Missing WEBHOOK_URL or TELEGRAM_WEBHOOK_URL env var');
        process.exit(2);
      }
      console.log('Registering webhook:', webhookUrl);
      const resp = await tg.setWebhook(webhookUrl, ['message', 'callback_query'], webhookSecret);
      console.log('setWebhook response:', JSON.stringify(resp, null, 2));
      process.exit(0);
    }

    if (cmd === 'get') {
      const info = await tg.getWebhookInfo();
      console.log('getWebhookInfo:', JSON.stringify(info, null, 2));
      process.exit(0);
    }

    if (cmd === 'delete') {
      const resp = await tg.deleteWebhook();
      console.log('deleteWebhook response:', JSON.stringify(resp, null, 2));
      process.exit(0);
    }
  } catch (err) {
    console.error('Error managing webhook:', err && err.message ? err.message : err);
    process.exit(3);
  }
}

run();
