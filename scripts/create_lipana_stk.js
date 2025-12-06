#!/usr/bin/env node
import fetch from 'node-fetch';

const API_BASE = process.env.LIPANA_API_BASE || 'https://api.lipana.dev';
const KEY = process.argv[2] || process.env.LIPANA_API_KEY;
const PHONE = process.argv[3] || process.env.TO_PHONE || '+254720798611';
const AMOUNT = Number(process.argv[4] || process.env.AMOUNT || 300);
const CALLBACK = process.argv[5] || process.env.CALLBACK_URL || 'https://betrix-ui.onrender.com/webhook/mpesa';

if (!KEY) {
  console.error('LIPANA_API_KEY required as argv[1] or LIPANA_API_KEY env');
  process.exit(2);
}

async function createStk() {
  const url = `${API_BASE}/v1/transactions`;
  const body = {
    amount: AMOUNT,
    currency: 'KES',
    phone: PHONE,
    reference: `betrix_test_${Date.now()}`,
    provider: 'lipana',
    callback_url: CALLBACK,
    description: 'BETRIX STK test'
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }

  if (!res.ok) {
    console.error('Non-OK response', res.status, text);
    throw new Error(`Non-OK response ${res.status}`);
  }
  return json || text;
}

(async function main(){
  try {
    const r = await createStk();
    console.log('Created STK:', JSON.stringify(r, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Fatal', err && err.message || err);
    process.exit(1);
  }
})();
