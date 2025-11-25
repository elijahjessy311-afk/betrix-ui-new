import Redis from 'ioredis';
import { createPaymentOrder, verifyAndActivatePayment } from '../src/handlers/payment-router.js';

(async () => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  try {
    const userId = process.env.TEST_USER_ID || '9999';
    const tier = process.env.TEST_TIER || 'VVIP';
    const paymentMethod = process.env.TEST_METHOD || 'PAYPAL';

    console.log('Creating order for', paymentMethod, '...');
    const order = await createPaymentOrder(redis, userId, tier, paymentMethod, process.env.TEST_REGION || 'US', {});
    console.log('Order created:', order.orderId);

    // Inspect mapping
    const byUser = await redis.get(`payment:by_user:${userId}:pending`);
    console.log('Mapped by_user:', byUser);
    if (order.providerRef) {
      const byRef = await redis.get(`payment:by_provider_ref:${paymentMethod}:${order.providerRef}`);
      console.log('Mapped by_provider_ref:', byRef);
    }

    if (order.metadata && order.metadata.checkoutUrl) {
      console.log('Checkout URL (PayPal):', order.metadata.checkoutUrl);
    }

    // Simulate verification (as if webhook arrived)
    console.log('Simulating verification...');
    const verification = await verifyAndActivatePayment(redis, order.orderId, `TESTTX_${Date.now()}`);
    console.log('Verification result:', verification);

    // Check user subscription
    const sub = await redis.hgetall(`user:${userId}`);
    console.log('User subscription record:', sub);

    console.log('Done.');
  } catch (e) {
    console.error('Test failed:', e);
  } finally {
    redis.disconnect();
  }
})();
