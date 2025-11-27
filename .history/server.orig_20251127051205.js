#!/usr/bin/env node
// Lightweight HTTP server to expose payment webhooks and admin verification endpoints
// Uses dynamic import to load ES modules from src/handlers/payment-router.js

import express from 'express';
import bodyParser from 'body-parser';
import Redis from 'ioredis';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // serve admin UI

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Admin is identified by Telegram user ID (259313404 by default)
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '259313404';

function adminAuth(req, res, next) {
  // Accept either Telegram user ID (259313404) or ADMIN_TOKEN env var
  const token = req.headers['x-admin-token'] || req.query.token || req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing admin token' });
  
  const bare = String(token).replace(/^Bearer\s+/i, '');
  
  // Check if token matches Telegram ID
  if (bare === ADMIN_TELEGRAM_ID) {
    return next();
  }
  
  // Fallback to ADMIN_TOKEN env var if set
  const envToken = process.env.ADMIN_TOKEN;
  if (envToken && bare === envToken) {
    return next();
  }
  
  return res.status(401).json({ error: 'Invalid admin token' });
}

// Verify PayPal webhook signature (simple version; PayPal signatures should be verified server-side via webhooks API)
function verifyPayPalSignature(body, headers) {
  // In production, use PayPal's webhook signature verification API
  // For now, accept any valid JSON POST from /webhooks/paypal
  // Real implementation: https://developer.paypal.com/api/webhooks/secure/
  return true;
}

// Verify M-Pesa callback signature (uses shared secret)
function verifyMPesaSignature(body, headers) {
  const mpesaSecret = process.env.MPESA_SECRET || '';
  if (!mpesaSecret) return true; // skip if not configured
  
  const signature = headers['x-signature'] || headers['signature'] || '';
  const expectedSig = crypto.createHmac('sha256', mpesaSecret).update(JSON.stringify(body)).digest('hex');
  return signature === expectedSig;
}

app.get('/_health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// M-Pesa / Safaricom Till webhook
app.post('/webhooks/mpesa', async (req, res) => {
  try {
    const payload = req.body || {};
    // expected payload: { Reference, TransactionID, Amount, Phone }
    const reference = payload.Reference || payload.reference || payload.ProviderRef || payload.providerRef;
    const transactionId = payload.TransactionID || payload.transactionId || payload.Trx || payload.trx || payload.txId || payload.transaction_id;
    const amount = payload.Amount || payload.amount || payload.TransAmount || payload.transAmount;
    const phone = payload.Phone || payload.msisdn || payload.phone;

    const paymentRouter = await import('./src/handlers/payment-router.js');
    if (reference) {
      // find order by provider ref across known providers
      let matchedOrder = null;
      for (const key of Object.keys(paymentRouter.PAYMENT_PROVIDERS)) {
        try {
          const oid = await redis.get(`payment:by_provider_ref:${key}:${reference}`);
          if (oid) { matchedOrder = oid; break; }
        } catch (e) {}
      }

      if (matchedOrder) {
        const tx = transactionId || (`MPESA-${Date.now()}`);
        await paymentRouter.verifyAndActivatePayment(redis, matchedOrder, tx);
        return res.json({ ok: true, matchedOrder, tx });
      }
    }

    // fallback: try phone lookup
    if (phone) {
      const phoneNorm = String(phone).replace(/\+|\s|-/g, '');
      const oid = await redis.get(`payment:by_phone:${phoneNorm}`);
      if (oid) {
        const tx = transactionId || (`MPESA-${Date.now()}`);
        await paymentRouter.verifyAndActivatePayment(redis, oid, tx);
        return res.json({ ok: true, matchedOrder: oid, tx });
      }
    }

    return res.status(404).json({ ok: false, error: 'Order not found for provided reference/phone' });
  } catch (err) {
    console.error('mpesa webhook error', err);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

// PayPal webhook handler (expects PayPal webhooks or IPN-like payloads)
app.post('/webhooks/paypal', async (req, res) => {
  try {
    const payload = req.body || {};
    const resource = payload.resource || payload;
    // PayPal may include invoice_id or custom which we use as orderId
    const orderRef = resource.invoice_id || resource.custom || resource.reference_id || resource.reference || resource.id;

    const paymentRouter = await import('./src/handlers/payment-router.js');
    if (orderRef) {
      // try to match providerRef -> order
      // in our PayPal flow we stored providerRef as PayPal order id or put checkoutUrl into metadata
      const oid = await redis.get(`payment:by_provider_ref:PAYPAL:${orderRef}`) || await redis.get(`payment:by_provider_ref:PAYPAL:${resource.id}`);
      if (oid) {
        const tx = resource.id || (`PAYPAL-${Date.now()}`);
        await paymentRouter.verifyAndActivatePayment(redis, oid, tx);
        return res.json({ ok: true, matchedOrder: oid, tx });
      }
    }

    // fallback: try to search for payment:order matching amount and payer
    return res.status(404).json({ ok: false, error: 'Order not found' });
  } catch (err) {
    console.error('paypal webhook error', err);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

// Admin endpoint: list pending orders
app.get('/admin/payments/pending', adminAuth, async (req, res) => {
  try {
    const keys = await redis.keys('payment:order:*');
    const results = [];
    for (const k of keys) {
      const raw = await redis.get(k);
      if (!raw) continue;
      const o = JSON.parse(raw);
      if (o && o.status === 'pending') results.push(o);
    }
    return res.json({ ok: true, pending: results });
  } catch (err) {
    console.error('admin pending error', err);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

// Admin: verify order manually
app.post('/admin/payments/verify', adminAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = body.orderId || body.order || body.id;
    const tx = body.transactionId || body.tx || `ADMIN-${Date.now()}`;
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId required' });

    const paymentRouter = await import('./src/handlers/payment-router.js');
    const result = await paymentRouter.verifyAndActivatePayment(redis, orderId, tx);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('admin verify error', err);
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : 'internal' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`BETRIX webhook & admin server listening on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => { redis.disconnect(); process.exit(0); });
process.on('SIGTERM', () => { redis.disconnect(); process.exit(0); });

