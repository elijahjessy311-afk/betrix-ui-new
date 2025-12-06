'use strict';
// startup-enforce-webhooks.js
// Safe no-op bootstrap used by Node -r preloading on Render.
// This file intentionally does minimal work: it logs once (server-side), and
// provides a safe export so require('./startup-enforce-webhooks.js') is a no-op.
//
// If you need webhook enforcement, replace this content with the canonical
// enforcement logic and ensure it is side-effect safe for preloading.
try {
  if (typeof process !== 'undefined' && process.env && !process.env.STARTUP_ENFORCE_LOGGED) {
    // non-sensitive log for build/runtime visibility
    // Avoid exposing secrets; only set a marker env var to avoid duplicate logs
    try { process.env.STARTUP_ENFORCE_LOGGED = '1'; } catch (e) { void e; }
    // Note: console output may be captured by Render logs
    console.debug && console.debug('startup-enforce-webhooks loaded (no-op)');
  }
} catch (e) { void e; }
module.exports = {};
