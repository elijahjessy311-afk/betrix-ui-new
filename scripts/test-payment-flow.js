import Redis from 'ioredis';
import { createCustomPaymentOrder, verifyPaymentFromMessage } from '../src/handlers/payment-router.js';

(async function(){
  const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  const userId = process.env.TEST_USER_ID || '1001';
  try {
    console.log('Creating signup order for user', userId);
    const order = await createCustomPaymentOrder(redis, userId, 150, 'SAFARICOM_TILL', 'KE', { signup: true, phone: '+254712345678' });
    console.log('Order created:', order);

    // Simulate user pasting a transaction confirmation message
    const sampleMsg = `Ksh150.00 received from +254712345678. Ref ${order.providerRef}. Transaction ID TRX${Date.now()}`;
    console.log('Simulating pasted message:', sampleMsg);

    const result = await verifyPaymentFromMessage(redis, userId, sampleMsg);
    console.log('Verify result:', result);
  } catch (e) {
    console.error('Test flow failed', e);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
})();
