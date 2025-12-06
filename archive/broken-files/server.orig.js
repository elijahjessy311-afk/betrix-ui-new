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
    // Verify signature if MPESA_SECRET is configured
    if (!verifyMPesaSignature(req.body, req.headers)) {
      console.warn('M-Pesa webhook signature verification failed');
      return res.status(401).json({ ok: false, error: 'signature verification failed' });
    }

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

    // Log unmatched payment for admin review
    await redis.setex(`unmatched:mpesa:${transactionId || Date.now()}`, 86400, JSON.stringify({ payload, timestamp: Date.now() }));
    return res.status(404).json({ ok: false, error: 'Order not found for provided reference/phone' });
  } catch (err) {
    console.error('mpesa webhook error', err);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

// PayPal webhook handler (expects PayPal webhooks or IPN-like payloads)
app.post('/webhooks/paypal', async (req, res) => {
  try {
    // Verify PayPal signature (basic check; in production use PayPal's webhook signature verification API)
    if (!verifyPayPalSignature(req.body, req.headers)) {
      console.warn('PayPal webhook signature verification failed');
      return res.status(401).json({ ok: false, error: 'signature verification failed' });
    }

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

    // Log unmatched payment for admin review
    await redis.setex(`unmatched:paypal:${resource.id || Date.now()}`, 86400, JSON.stringify({ payload, timestamp: Date.now() }));
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

// Admin endpoint: list unmatched payments
app.get('/admin/payments/unmatched', adminAuth, async (req, res) => {
  try {
    const unmatchedMpesa = await redis.keys('unmatched:mpesa:*');
    const unmatchedPaypal = await redis.keys('unmatched:paypal:*');
    const results = [];
    
    for (const k of [...unmatchedMpesa, ...unmatchedPaypal]) {
      const raw = await redis.get(k);
      if (!raw) continue;
      results.push({ key: k, data: JSON.parse(raw) });
    }
    
    return res.json({ ok: true, unmatched: results });
  } catch (err) {
    console.error('admin unmatched error', err);
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

// Serve admin UI dashboard
app.get('/admin', adminAuth, (req, res) => {
  res.send(getAdminHTML());
});

// Admin API: get dashboard data (pending + unmatched)
app.get('/admin/api/dashboard', adminAuth, async (req, res) => {
  try {
    const pendingKeys = await redis.keys('payment:order:*');
    const pending = [];
    for (const k of pendingKeys) {
      const raw = await redis.get(k);
      if (!raw) continue;
      const o = JSON.parse(raw);
      if (o && o.status === 'pending') pending.push(o);
    }

    const unmatchedMpesa = await redis.keys('unmatched:mpesa:*');
    const unmatchedPaypal = await redis.keys('unmatched:paypal:*');
    const unmatched = [];
    for (const k of [...unmatchedMpesa, ...unmatchedPaypal]) {
      const raw = await redis.get(k);
      if (!raw) continue;
      unmatched.push({ key: k, data: JSON.parse(raw) });
    }

    return res.json({ ok: true, pending, unmatched });
  } catch (err) {
    console.error('admin dashboard error', err);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

function getAdminHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BETRIX Admin - Payments</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 30px; display: flex; align-items: center; gap: 10px; }
    .logo { font-size: 24px; }
    .section { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { color: #333; margin-bottom: 15px; font-size: 18px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f9f9f9; padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    .table td { padding: 10px; border-bottom: 1px solid #eee; }
    .table tr:hover { background: #f9f9f9; }
    .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .status.pending { background: #fff3cd; color: #856404; }
    .status.unmatched { background: #f8d7da; color: #721c24; }
    .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #007bff; color: white; }
    .btn-success { background: #28a745; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .btn:hover { opacity: 0.9; }
    .loading { color: #666; padding: 20px; text-align: center; }
    .error { color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    .success { color: #155724; background: #d4edda; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%; }
    .modal-content h3 { margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 600; }
    .form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    .modal-buttons { display: flex; gap: 10px; justify-content: flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <h1><span class="logo">🌀</span> BETRIX Admin - Payments</h1>
    <div id="message"></div>
    
    <div class="section">
      <h2>⏳ Pending Orders</h2>
      <div id="pending-content" class="loading">Loading...</div>
    </div>
    
    <div class="section">
      <h2>⚠️ Unmatched Payments</h2>
      <div id="unmatched-content" class="loading">Loading...</div>
    </div>
  </div>

  <div id="verifyModal" class="modal">
    <div class="modal-content">
      <h3>Verify Order</h3>
      <div class="form-group">
        <label>Order ID:</label>
        <input type="text" id="verifyOrderId" readonly>
      </div>
      <div class="form-group">
        <label>Transaction ID (optional):</label>
        <input type="text" id="verifyTxId" placeholder="Leave empty for auto-generate">
      </div>
      <div class="modal-buttons">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitVerify()">Verify Payment</button>
      </div>
    </div>
  </div>

  <script>
    const token = localStorage.getItem('adminToken') || prompt('Enter admin token (Telegram ID):');
    if (token) localStorage.setItem('adminToken', token);

    function showMessage(text, type = 'info') {
      const msg = document.getElementById('message');
      msg.className = type;
      msg.textContent = text;
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 5000);
    }

    async function loadDashboard() {
      try {
        const res = await fetch('/admin/api/dashboard', {
          headers: { 'x-admin-token': token }
        });
        const data = await res.json();
        if (!data.ok) { showMessage('Failed to load dashboard', 'error'); return; }
        
        renderPending(data.pending || []);
        renderUnmatched(data.unmatched || []);
      } catch (err) {
        showMessage('Error: ' + err.message, 'error');
      }
    }

    function renderPending(orders) {
      const html = orders.length === 0 ? '<p style="color: #999;">No pending orders.</p>' : \`
        <table class="table">
          <tr>
            <th>Order ID</th>
            <th>User</th>
            <th>Tier</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
          \${orders.map(o => \`
            <tr>
              <td><code style="font-size: 11px;">\${o.orderId.substring(0, 20)}...</code></td>
              <td>\${o.userId}</td>
              <td>\${o.tier}</td>
              <td>\${o.totalAmount} \${o.currency}</td>
              <td>\${o.paymentMethod}</td>
              <td>\${new Date(o.createdAt).toLocaleString()}</td>
              <td><button class="btn btn-success" onclick="openVerifyModal('\${o.orderId}')">Verify</button></td>
            </tr>
          \`).join('')}
        </table>
      \`;
      document.getElementById('pending-content').innerHTML = html;
    }

    function renderUnmatched(unmatched) {
      const html = unmatched.length === 0 ? '<p style="color: #999;">No unmatched payments.</p>' : \`
        <table class="table">
          <tr>
            <th>Payment ID</th>
            <th>Amount</th>
            <th>Phone</th>
            <th>Timestamp</th>
            <th>Data</th>
          </tr>
          \${unmatched.map(u => \`
            <tr>
              <td><code style="font-size: 11px;">\${u.key.substring(0, 30)}...</code></td>
              <td>\${u.data.payload?.Amount || u.data.payload?.amount || '-'}</td>
              <td>\${u.data.payload?.Phone || u.data.payload?.phone || '-'}</td>
              <td>\${new Date(u.data.timestamp).toLocaleString()}</td>
              <td><button class="btn btn-primary" onclick="alert(JSON.stringify(u.data.payload, null, 2))">View</button></td>
            </tr>
          \`).join('')}
        </table>
      \`;
      document.getElementById('unmatched-content').innerHTML = html;
    }

    function openVerifyModal(orderId) {
      document.getElementById('verifyOrderId').value = orderId;
      document.getElementById('verifyTxId').value = '';
      document.getElementById('verifyModal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('verifyModal').classList.remove('active');
    }

    async function submitVerify() {
      const orderId = document.getElementById('verifyOrderId').value;
      const txId = document.getElementById('verifyTxId').value || undefined;
      try {
        const res = await fetch('/admin/payments/verify', {
          method: 'POST',
          headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, transactionId: txId })
        });
        const data = await res.json();
        if (data.ok) {
          showMessage('✅ Order verified successfully!', 'success');
          closeModal();
          loadDashboard();
        } else {
          showMessage('❌ ' + (data.error || 'Verification failed'), 'error');
        }
      } catch (err) {
        showMessage('Error: ' + err.message, 'error');
      }
    }

    loadDashboard();
    setInterval(loadDashboard, 30000); // refresh every 30s
  </script>
</body>
</html>
\`;
}

app.listen(PORT, HOST, () => {
  console.log(\`BETRIX webhook & admin server listening on \${HOST}:\${PORT}\`);
  console.log(\`Admin UI: http://\${HOST}:\${PORT}/admin\`);
  console.log(\`Admin token: \${ADMIN_TELEGRAM_ID}\`);
});

// Graceful shutdown
process.on('SIGINT', () => { redis.disconnect(); process.exit(0); });
process.on('SIGTERM', () => { redis.disconnect(); process.exit(0); });

