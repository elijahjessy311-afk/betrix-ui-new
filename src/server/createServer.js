const path = require('path');

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
    try { appModule = require(c); break; } catch (e) { }
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
  const express = require('express');
  module.exports.createServer = function createServer() {
    const app = express();
/* TEMP WEBHOOK LOGGING MIDDLEWARE - START (remove after debugging) */
try {
  if (typeof app !== "undefined" && !app.__hasTempWebhookLogger) {
    app.__hasTempWebhookLogger = true;
    app.use("/webhook", (req, res, next) => {
      try {
        console.log("WEBHOOK INCOMING", {
          method: req.method,
          url: req.originalUrl || req.url,
          secretHeader: req.headers["x-telegram-bot-api-secret-token"]
        });
      } catch (e) { console.error("WEBHOOK LOG ERROR", e); }
      next();
    });
  }
} catch (e) { console.error("TEMP WEBHOOK MIDDLEWARE INSERTION ERROR", e); }
/* TEMP WEBHOOK LOGGING MIDDLEWARE - END */
    app.get('/health', (req, res) => res.status(200).send('ok'));
    return app;
  };
}

if (require.main === module) {
  const http = require('http');
  const server = module.exports.createServer();
  const port = process.env.PORT ? Number(process.env.PORT) : (process.env.PORT || process.env.PORT || 3000);
  http.createServer(server).listen(port, () => {
    console.log(`SERVER: listening on port ${port}`);
  });
}

