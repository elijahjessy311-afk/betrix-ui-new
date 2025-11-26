#!/usr/bin/env node
/*
  Simple e2e simulation script for BETRIX handlers
  - Loads handlers directly and runs a simulated /live command
  - Simulates a callback 'bet_fixture_{id}' to create betslip
*/
import Redis from 'ioredis';
import { handleMessage, handleCallbackQuery } from '../src/handlers/telegram-handler-v2.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

async function run() {
  try {
    const mockUpdate = { message: { chat: { id: 9999 }, from: { id: 424242 }, text: '/live' } };
    console.log('--- Running /live simulation ---');
    const res = await handleMessage(mockUpdate, redis, { apiFootball: { getLive: async () => ({ response: [ { fixture: { id: 11111, status: { short: 'LIVE', elapsed: 12 } }, teams: { home: { name: 'Home FC' }, away: { name: 'Away United' } }, goals: { home: 1, away: 0 } } ] }) } });
    console.log('Message result:', res);

    // Simulate pressing quick bet callback for fixture 11111
    console.log('--- Simulating bet callback ---');
    const cb = { id: 'cb1', from: { id: 424242 }, message: { chat: { id: 9999 } }, data: 'bet_fixture_11111' };
    const cbRes = await handleCallbackQuery(cb, redis, { apiFootball: { getFixture: async (id) => ({ response: [ { teams: { home: { name: 'Home FC' }, away: { name: 'Away United' } } } ] }) } });
    console.log('Callback result:', cbRes);
  } catch (err) {
    console.error('e2e-simulate error', err);
    process.exit(1);
  } finally {
    redis.quit();
  }
}

run();
