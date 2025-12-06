// Auto-generated wrapper to export createServer correctly for bootstrap
try {
  const mod = require('./app');
  if (mod && typeof mod.createServer === 'function') {
    module.exports = { createServer: mod.createServer };
  } else if (typeof mod === 'function') {
    module.exports = { createServer: mod };
  } else if (mod && (mod.default && typeof mod.default === 'function')) {
    module.exports = { createServer: mod.default };
  } else {
    // fallback: no createServer found; export the module as-is for debugging
    module.exports = mod || {};
    console.error('WRAPPER-WARN: no createServer found in ./app; exported module as-is');
  }
} catch (e) {
  console.error('WRAPPER-ERR', e && (e.stack || e.message || String(e)));
  module.exports = {};
}

// Safely expose the telegram router so callers (e.g. the real server bootstrap)
// can mount it. Avoid calling `app.use` here because `app` may not be defined
// in this wrapper context which previously caused runtime/lint errors.
try {
  module.exports.telegramRouter = require('./telegram-webhook');
} catch (e) {
  // If the telegram webhook module is missing, keep exports intact and
  // allow the caller to decide how to proceed. Log at debug level.
  // console.debug('telegram-webhook not available', e && e.message);
}
