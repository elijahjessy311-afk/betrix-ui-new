import assert from 'assert';
import { getPaymentGuide, PAYMENT_PROVIDERS } from '../src/handlers/payment-router.js';

console.log('\n📚 Payment Guides Test\n');

for (const key of Object.keys(PAYMENT_PROVIDERS)) {
  const guide = getPaymentGuide(key);
  console.log(`- Checking guide for ${key}:`, guide ? 'OK' : 'MISSING');
  assert(guide, `Guide should exist for ${key}`);
  assert(guide.steps && guide.steps.length > 0, `Guide steps should be present for ${key}`);
}

console.log('\n✅ All payment guides present and non-empty\n');
