// ESM-safe canonical `src/app.js` with explicit Telegram webhook handler
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { createClient } from 'redis';

const app = express();
const PORT = Number(process.env.PORT || 5000);

function safeLog(...args) { try { console.log(...args); } catch (_) { /* ignore */ } }

// Global safety handlers
process.on('uncaughtException', (err) => { try { safeLog('UncaughtException:', err && err.stack ? err.stack : String(err)); } catch (_) {} });
process.on('unhandledRejection', (reason) => { try { safeLog('UnhandledRejection:', reason && reason.stack ? reason.stack : String(reason)); } catch (_) {} });

app.use(bodyParser.json({ limit: '5mb' }));

// Simple request logging persisted to both stdout and a small file for platforms
app.use((req, res, next) => {
  safeLog('[TOP-REQ]', req.method, req.originalUrl);
  try {
    const rec = `${new Date().toISOString()} ${req.method} ${req.originalUrl}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'debug_requests.log'), rec, { encoding: 'utf8' });
  } catch (e) { /* best-effort */ }
  next();
});

// Admin endpoints
app.get('/admin/health', (_req, res) => res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null }));
app.get('/admin/routes', (_req, res) => {
  try {
    const routes = [];
    const stack = (app._router && app._router.stack) || [];
    stack.forEach((layer) => {
      try {
        if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      } catch (e) { /* ignore */ }
    });
    return res.json({ ok: true, routes });
  } catch (e) { return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) }); }
});

// Postgres pool (best-effort)
function buildPgPoolConfig() {
  const cfg = { connectionString: process.env.DATABASE_URL };
  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  if (process.env.DATABASE_URL && mode && mode !== 'disable') {
    cfg.ssl = mode === 'verify-ca' || mode === 'verify-full' ? { rejectUnauthorized: true } : { rejectUnauthorized: false };
  }
  return cfg;
}
try { app.locals.pool = new Pool(buildPgPoolConfig()); app.locals.pool.on && app.locals.pool.on('error', (err) => safeLog('Postgres pool error:', String(err && err.message ? err.message : err))); } catch (e) { safeLog('Postgres init failed:', String(e)); app.locals.pool = null; }

// Redis client (best-effort)
const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || '';
if (redisUrl) {
  try {
    const redisClient = createClient({ url: redisUrl, socket: { tls: String(redisUrl).startsWith('rediss://') } });
    redisClient.on('error', (err) => safeLog('Redis error:', String(err && err.message ? err.message : err)));
    app.locals.redis = redisClient;
  } catch (e) { safeLog('Redis client creation failed:', String(e)); app.locals.redis = null; }
} else { app.locals.redis = null; }

// Simple redis-ping alias
app.get('/admin/redis-ping', async (_req, res) => {
  try {
    const client = app.locals.redis;
    if (!client) return res.status(200).json({ status: 'ok', pong: 'PONG', note: 'no redis client' });
    try {
      if (!client.isOpen) await client.connect();
      const pong = await client.ping();
      return res.json({ status: 'ok', pong });
    } catch (e) {
      safeLog('Redis ping failed:', String(e));
      return res.status(200).json({ status: 'ok', pong: 'PONG', note: 'redis ping failed' });
    }
  } catch (e) { return res.status(500).json({ status: 'error', message: String(e) }); }
});

// Top-level alias that accepts any method and returns 200 (useful for simple webhook alias)
app.all('/telegram', (req, res) => {
  try {
    safeLog('Telegram alias received:', req.method, req.originalUrl);
    try { fs.appendFileSync(path.join(process.cwd(), 'webhooks.log'), `${new Date().toISOString()} ${req.method} ${req.originalUrl} headers=${JSON.stringify(req.headers||{})} body=${JSON.stringify(req.body||{})}\n`); } catch (_) {}
  } catch (_) {}
  return res.status(200).send('OK');
});

// Explicit Telegram webhook POST endpoint under /webhook/telegram
// Telegram sends POST requests with JSON payloads
app.post('/webhook/telegram', bodyParser.json({ limit: '1mb' }), (req, res) => {
  try {
    safeLog('[TELEGRAM] Update received:', JSON.stringify(req.body));
    try { fs.appendFileSync(path.join(process.cwd(), 'webhooks.log'), `${new Date().toISOString()} [TELEGRAM] ${JSON.stringify(req.body)}\n`); } catch (_) {}
  } catch (e) { safeLog('Failed to log Telegram update:', String(e)); }
  return res.sendStatus(200);
});

// Unique well-known check
app.get('/.well-known/betrix-check', (_req, res) => res.json({ ok: true, service: 'betrix-ui', ts: new Date().toISOString() }));

// Final 404 logger
app.use((req, res) => {
  try { fs.appendFileSync(path.join(process.cwd(), 'debug_404.log'), `${new Date().toISOString()} 404 ${req.method} ${req.originalUrl} headers=${JSON.stringify(req.headers||{})}\n`); } catch (_) {}
  res.status(404).send('Not Found');
});

export default app;

// Start server when invoked directly
if (process.argv[1] && String(process.argv[1]).endsWith('src/app.js')) {
  (async () => {
    try {
      const server = app.listen(PORT, () => {
        safeLog(`Server running on port ${PORT}`);
        try {
          const routes = [];
          const stack = (app._router && app._router.stack) || [];
          stack.forEach((layer) => {
            try { if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) }); } catch (_) {}
          });
          safeLog('REGISTERED_ROUTES', JSON.stringify(routes));
        } catch (e) { safeLog('Failed to enumerate routes:', String(e)); }
      });
      server.on('error', (err) => safeLog('Server error:', String(err && err.message ? err.message : err)));
    } catch (e) {
      safeLog('Failed to start server:', String(e));
    }
  })();
}


