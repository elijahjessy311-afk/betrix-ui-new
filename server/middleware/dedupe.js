/**
 * server/middleware/dedupe.js
 * Minimal dedupe middleware using redis SET NX EX. Safe no-op when Redis not configured.
 */
const crypto = require('crypto');

let redisClient = null;
let redisReady = false;

function safeLog(...args) { try { console.warn('[dedupe]', ...args); } catch (e) { /* ignore */ } }

async function initRedis() {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || process.env.REDIS || null;
  if (!url) {
    safeLog('No REDIS_URL configured — dedupe disabled');
    return null;
  }
  try {
    const { createClient } = require('redis');
    const client = createClient({ url });
    client.on('error', (err) => { safeLog('redis error', err && err.message ? err.message : err); redisReady = false; });
    await client.connect();
    redisClient = client;
    redisReady = true;
    safeLog('Connected to Redis for dedupe');
    return redisClient;
  } catch (e) {
    safeLog('Failed to connect to Redis for dedupe:', e && e.message ? e.message : e);
    redisClient = null;
    redisReady = false;
    return null;
  }
}

module.exports = function dedupe(ttlSeconds = 60) {
  // attempt async init but don't block
  initRedis().catch(() => {});

  return async function (req, res, next) {
    try {
      const method = String(req.method || '').toUpperCase();
      if (!['POST', 'PUT', 'PATCH'].includes(method)) return next();

      if (!redisReady || !redisClient) return next(); // fail-open

      const bodyStr = (req.body && typeof req.body === 'object') ? JSON.stringify(req.body) : String(req.body || '');
      const authHint = (req.headers && req.headers.authorization) ? String(req.headers.authorization).slice(0, 16) : '';
      const raw = `${method}|${req.originalUrl || req.url}|${bodyStr}|${authHint}`;
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      const key = `dedupe:${hash}`;

      const ttl = Math.max(1, parseInt(ttlSeconds, 10) || 60);
      // NX true -> set only if not exists; EX sets expiry seconds
      const setResult = await redisClient.set(key, Date.now().toString(), { NX: true, EX: ttl });
      if (setResult === 'OK' || setResult === true) return next();

      // duplicate
      res.status(429).json({ ok: false, error: 'Duplicate request', code: 'DUPLICATE_REQUEST' });
      return;
    } catch (err) {
      safeLog('dedupe middleware error:', err && err.message ? err.message : err);
      return next();
    }
  };
};

