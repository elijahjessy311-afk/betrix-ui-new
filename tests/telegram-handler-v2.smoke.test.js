import assert from 'assert';
import { test } from 'node:test';
import v2Handler, { handleMessage, handleCallbackQuery, handleCommand, handleNaturalLanguage } from '../src/handlers/telegram-handler-v2.js';

// Lightweight mocks to keep the smoke test offline
class MockRedis {
  constructor() { this.store = new Map(); }
  async get(k) { return this.store.get(k) ?? null; }
  async set(k, v) { this.store.set(k, String(v)); return 'OK'; }
  async hget() { return null; }
}

const services = {
  apiFootball: { getLive: async () => ({ response: [] }) },
  payment: { createPaymentOrder: async () => ({ orderId: 'smoke-1', totalAmount: 100 }) }
};

test('telegram-handler-v2: default and named imports load and callable', async () => {
  assert.ok(v2Handler, 'default export should exist');
  assert.strictEqual(typeof handleCallbackQuery, 'function');
  assert.strictEqual(typeof handleMessage, 'function');
  // ensure optional named exports exist and are callable (or at least defined)
  assert.strictEqual(typeof handleCommand, 'function');
  assert.strictEqual(typeof handleNaturalLanguage, 'function');

  const redis = new MockRedis();

  // ensure calling the named handler does not throw synchronously or as a rejected promise
  await assert.doesNotReject(async () => {
    // minimal callback query shape
    const cb = { id: 'cb_smoke', from: { id: 1 }, message: { chat: { id: 1 } }, data: 'noop_smoke' };
    // Some handlers may return undefined or lightweight results; we only assert no crash
    // Use both named and default invocation styles
    await handleCallbackQuery(cb, redis, services);
    if (typeof v2Handler.handleCallbackQuery === 'function') {
      await v2Handler.handleCallbackQuery(cb, redis, services);
    }
  });

  // call a message handler shape
  await assert.doesNotReject(async () => {
    const update = { message: { chat: { id: 1 }, from: { id: 1 }, text: '/start' } };
    await handleMessage(update, redis, services);
    if (typeof v2Handler.handleMessage === 'function') {
      await v2Handler.handleMessage(update, redis, services);
    }
  });
});
