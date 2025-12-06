const path = require('path');

// top-level shared symbols used by health/webhook guards and graceful shutdown
let app;
let server;
let queue;
// optional express reference (try-catch so this file can be parsed without express installed)
let express;
try { express = require('express'); } catch (e) { express = null; }

let appModule;
try {
  const candidates = [
    path.join(process.cwd(), 'src', 'server', 'app.js'),
    path.join(process.cwd(), 'src', 'index.js'),
    path.join(process.cwd(), 'src', 'server', 'index.js'),
    path.join(process.cwd(), 'server.js'),
    path.join(process.cwd(), 'index.js')
  ];
  for (const c of candidates) {
    try { appModule = require(c); break; } catch (e) { void e; }
  }
} catch (e) {
  appModule = null;
}

if (appModule && typeof appModule.createServer === 'function') {
  module.exports.createServer = appModule.createServer;
} else if (appModule && typeof appModule === 'function') {
  module.exports.createServer = appModule;
} else if (appModule && appModule.default && typeof appModule.default.createServer === 'function') {
  module.exports.createServer = appModule.default.createServer;
} else {
  try { require('express'); } catch (e) { void e; }
  module.exports.createServer = function createServer() {
    app = (express || require('express'))();
/* COPILOT-HEALTH-READINESS-GUARD - START
   Lightweight /health and /ready endpoints and graceful shutdown handling.
   - /health: liveness probe (very cheap)
   - /ready: readiness probe (set when app is ready to accept traffic)
   - graceful shutdown: stop accepting new requests, wait for in-flight requests and worker drain
   Remove this block when you implement your own production-ready lifecycle management.
*/
try {
  // readiness flag
  if (typeof app !== "undefined" && typeof globalThis.__isReady === "undefined") {
    globalThis.__isReady = true;

    // Liveness: extremely lightweight (no DB/Redis checks)
    app.get('/health', (req, res) => {
      res.status(200).send('OK');
    });

    // Readiness: set to true only when app has finished startup tasks
    app.get('/ready', (req, res) => {
      res.status(globalThis.__isReady ? 200 : 503).send(globalThis.__isReady ? 'ready' : 'not ready');
    });

    // Graceful shutdown helper: stop accepting new requests and wait for in-flight
    (function setupGracefulShutdown() {
      if (typeof process === 'undefined' || !process.on) return;
      const shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);

      let shuttingDown = false;
      // track in-flight requests
      let inflight = 0;
      app.use((req, res, next) => {
        if (shuttingDown) {
          // refuse new requests during shutdown
          res.setHeader('Connection', 'close');
          return res.status(503).send('shutting down');
        }
        inflight++;
        res.on('finish', () => { inflight = Math.max(0, inflight - 1); });
        next();
      });

      async function doShutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        globalThis.__isReady = false;
        console.info(JSON.stringify({ event: 'shutdown.initiated', signal, timestamp: new Date().toISOString(), inflight }));
        // stop accepting new connections: if you use http.Server, close it if available
        try {
          if (typeof server !== 'undefined' && server && server.close) {
            server.close(() => { console.info(JSON.stringify({ event: 'http.closed', timestamp: new Date().toISOString() })); });
          }
        } catch (e) { console.error('error closing server', e); }

        // wait for inflight to drain or timeout
        const start = Date.now();
        while (inflight > 0 && (Date.now() - start) < shutdownTimeoutMs) {
          await new Promise(r => setTimeout(r, 200));
        }

        // optionally allow worker to finish (if you have a worker drain API, call it here)
        try {
          if (typeof queue !== 'undefined' && queue && queue.drain) {
            await queue.drain(); // best-effort; implement drain in your queue
            console.info(JSON.stringify({ event: 'queue.drained', timestamp: new Date().toISOString() }));
          }
        } catch (e) { void e; }

        console.info(JSON.stringify({ event: 'shutdown.complete', timestamp: new Date().toISOString(), inflight }));
        // exit process (let platform restart)
        try { process.exit(0); } catch (e) { void e; }
      }

      process.on('SIGTERM', () => doShutdown('SIGTERM'));
      process.on('SIGINT', () => doShutdown('SIGINT'));
    })();
  }
} catch (e) { console.error('COPILOT-HEALTH-READINESS-GUARD ERROR', e); }
/* COPILOT-HEALTH-READINESS-GUARD - END */
    app.get('/health', (req, res) => res.status(200).send('ok'));
    return app;
  };
} 

if (require.main === module) {
  const http = require('http');
  server = module.exports.createServer();
  const port = process.env.PORT ? Number(process.env.PORT) : (process.env.PORT || process.env.PORT || 3000);
  http.createServer(server).listen(port, () => {
    console.log(`SERVER: listening on port ${port}`);
  });
}


/* COPILOT-WEBHOOK-MINIMAL-GUARD - START
   Minimal webhook handler: validate secret, enqueue, respond 200 immediately.
   Replace queue.enqueue with your queue API.
*/
try {
  if (typeof app !== "undefined" && !app.__hasCopilotWebhook) {
    app.__hasCopilotWebhook = true;
    app.post('/webhook', (req, res) => {
      try {
        const secret = req.get('x-telegram-bot-api-secret-token') || '';
        if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
          console.warn('webhook: invalid secret');
          return res.status(403).send('forbidden');
        }
        // structured enqueue log
        try { console.log(JSON.stringify({ event: 'webhook.received', ts: new Date().toISOString(), size: JSON.stringify(req.body || {}).length })); } catch(e){ void e; }
        // enqueue non-blocking
        if (typeof queue !== 'undefined' && queue.enqueue) {
          try { queue.enqueue('telegram:update', req.body); } catch(e) { console.error('enqueue failed', e); }
        } else {
          console.debug('No queue available: webhook received (debug)');
        }
        // respond immediately
        res.status(200).send('OK');
      } catch (err) {
        console.error('webhook handler error', err);
        res.status(200).send('OK');
      }
    });
  }
} catch (e) { console.error('COPILOT-WEBHOOK-MINIMAL-GUARD ERROR', e); }
/* COPILOT-WEBHOOK-MINIMAL-GUARD - END */



/* COPILOT-HEALTH-READINESS-GUARD - START
   Lightweight /health and /ready endpoints, robust queue wrapper and graceful shutdown.
   Idempotent. Backups are created before modification.
*/
try {
  if (typeof app !== "undefined" && typeof globalThis.__isReady === "undefined") {
    globalThis.__isReady = true;

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', uptime: process.uptime() });
    });

    app.get('/ready', (req, res) => {
      res.status(globalThis.__isReady ? 200 : 503).send(globalThis.__isReady ? 'ready' : 'not ready');
    });

    (function setupQueueWrapper() {
      if (globalThis.queue && globalThis.queue.__copilotWrapped) return;
      const wrapper = { __copilotWrapped: true };
      function safeLog(obj) { try { console.log(JSON.stringify(obj)); } catch(e) { console.log(obj); } }

      try {
        let QueueClient = null;
        try { QueueClient = require('bullmq').Queue; safeLog({ event: 'queue.impl', impl: 'bullmq' }); } catch(e) { void e; }
        if (!QueueClient) {
          try { QueueClient = require('bull').Queue; safeLog({ event: 'queue.impl', impl: 'bull' }); } catch(e) { void e; }
        }

        if (QueueClient) {
          if (globalThis.myQueue) {
            wrapper.enqueue = async (name, payload) => { try { await globalThis.myQueue.add(name, payload); safeLog({ event: 'webhook.enqueued', name }); } catch(e){ safeLog({ event:'enqueue.error', error: e.message }); } };
            wrapper.drain = async () => { try { if (globalThis.myQueue.close) await globalThis.myQueue.close(); safeLog({ event: 'queue.closed' }); } catch(e){ safeLog({ event:'drain.error', error: e.message }); } };
          } else {
            try {
              const q = new QueueClient('telegram-updates');
              globalThis.myQueue = q;
              wrapper.enqueue = async (name, payload) => { try { await q.add(name, payload); safeLog({ event: 'webhook.enqueued', name }); } catch(e){ safeLog({ event:'enqueue.error', error: e.message }); } };
              wrapper.drain = async () => { try { if (q.close) await q.close(); safeLog({ event: 'queue.closed' }); } catch(e){ safeLog({ event:'drain.error', error: e.message }); } };
            } catch(e) { safeLog({ event: 'queue.create.failed', error: e.message }); }
          }
        }
      } catch(e) { safeLog({ event: 'queue.require.failed', error: e.message }); }

      if (!wrapper.enqueue || !wrapper.drain) {
        try {
          const IORedis = require('ioredis');
          const redisUrl = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';
          const redisClient = new IORedis(redisUrl);
          globalThis.redisClient = redisClient;
          wrapper.enqueue = async (name, payload) => {
            try { await redisClient.rpush('queue:telegram:updates', JSON.stringify(payload)); safeLog({ event: 'webhook.enqueued.redis' }); } catch (e) { safeLog({ event: 'enqueue.redis.error', error: e.message }); }
          };
          wrapper.drain = async () => {
            try {
              const timeout = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
              const start = Date.now();
              while ((Date.now() - start) < timeout) {
                const len = await redisClient.llen('queue:telegram:updates');
                if (len === 0) break;
                await new Promise(r => setTimeout(r, 200));
              }
              safeLog({ event: 'queue.drained.redis' });
            } catch (e) { safeLog({ event: 'drain.redis.error', error: e.message }); }
          };
        } catch (e) { safeLog({ event: 'ioredis.not.available', error: e.message }); }
      }

      if (!wrapper.enqueue) wrapper.enqueue = async (name, _payload) => { safeLog({ event: 'enqueue.noop', name }); };
      if (!wrapper.drain) wrapper.drain = async () => { safeLog({ event: 'drain.noop' }); };

      globalThis.queue = wrapper;
      safeLog({ event: 'queue.wrapper.ready' });
    })();

    (function setupGracefulShutdown() {
      const shutdownTimeoutMs = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
      let shuttingDown = false;
      let inflight = 0;

      app.use((req, res, next) => {
        if (shuttingDown) {
          res.setHeader('Connection', 'close');
          return res.status(503).send('shutting down');
        }
        inflight++;
        res.on('finish', () => { inflight = Math.max(0, inflight - 1); });
        next();
      });

      async function doShutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        globalThis.__isReady = false;
        console.info(JSON.stringify({ event: 'shutdown.initiated', signal, timestamp: new Date().toISOString(), inflight }));
        try { if (typeof server !== 'undefined' && server && server.close) server.close(() => { console.info(JSON.stringify({ event: 'http.closed', timestamp: new Date().toISOString() })); }); } catch (e) { console.error('error closing server', e); }

        const start = Date.now();
        while (inflight > 0 && (Date.now() - start) < shutdownTimeoutMs) { await new Promise(r => setTimeout(r, 200)); }

        try { if (globalThis.queue && typeof globalThis.queue.drain === 'function') { await globalThis.queue.drain(); console.info(JSON.stringify({ event: 'queue.drained', timestamp: new Date().toISOString() })); } else { console.info('No queue.drain found; graceful drain is best-effort.'); } } catch (e) { console.error('queue drain error', e); }

        console.info(JSON.stringify({ event: 'shutdown.complete', timestamp: new Date().toISOString(), inflight }));
        try { process.exit(0); } catch (e) { void e; }
      }

      process.on('SIGTERM', () => doShutdown('SIGTERM'));
      process.on('SIGINT', () => doShutdown('SIGINT'));
    })();
  }
} catch (e) { console.error('COPILOT-HEALTH-READINESS-GUARD ERROR', e); }
/* COPILOT-HEALTH-READINESS-GUARD - END */

/* COPILOT-WEBHOOK-MINIMAL-GUARD - START
   Minimal webhook handler that uses globalThis.queue.enqueue and responds immediately.
*/
try {
  if (typeof app !== "undefined" && !app.__hasCopilotWebhook) {
    app.__hasCopilotWebhook = true;
    app.post('/webhook', express.json({ limit: '1mb' }), (req, res) => {
      try {
        const secret = req.get('x-telegram-bot-api-secret-token') || '';
        if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
          console.warn('webhook: invalid secret');
          return res.status(403).send('forbidden');
        }
        try { console.log(JSON.stringify({ event: 'webhook.received', ts: new Date().toISOString(), size: JSON.stringify(req.body || {}).length })); } catch(e){ void e; }
        try {
          if (globalThis.queue && typeof globalThis.queue.enqueue === 'function') {
            globalThis.queue.enqueue('telegram:update', req.body).catch(()=>{});
            console.log(JSON.stringify({ event: 'webhook.enqueued', ts: new Date().toISOString() }));
          } else {
            console.debug('No queue available; webhook received (debug).');
          }
        } catch (e) { console.error('enqueue error', e); }
        res.status(200).send('OK');
      } catch (err) {
        console.error('webhook handler error', err);
        res.status(200).send('OK');
      }
    });
  }
} catch (e) { console.error('COPILOT-WEBHOOK-MINIMAL-GUARD ERROR', e); }
/* COPILOT-WEBHOOK-MINIMAL-GUARD - END */
