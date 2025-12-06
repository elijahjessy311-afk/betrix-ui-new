// Minimal webhook handler (safe, compact)
// Replaces the previously malformed file with a compact, well-formed handler
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN || '';

async function sendTelegram(method, payload) {
  if (!TELEGRAM_TOKEN) {
    // no token configured; skip outbound call
    return null;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return text; }
  } catch (err) {
    console.error('sendTelegram error', err && err.message || err);
    return null;
  }
}

module.exports.handler = async function handler(event) {
  try {
    const url = require('url');
    const qs = url.parse(event.rawUrl || event.path || '', true).query;
    if (process.env.WEBHOOK_SECRET && qs.secret !== process.env.WEBHOOK_SECRET) {
      return { statusCode: 403, body: 'Forbidden' };
    }
    let body = {};
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {}; } catch (e) { body = {}; }

    if (body && body.callback_query) {
      const cb = body.callback_query;
      try {
        await sendTelegram('answerCallbackQuery', { callback_query_id: cb.id, text: 'Received' });
      } catch (e) {
        console.debug('answerCallbackQuery error', e && e.message || e);
      }
      return { statusCode: 200, body: 'OK' };
    }

    const text = (body.message && body.message.text) ? body.message.text.trim() : '';
    const chatId = body.message && body.message.chat && body.message.chat.id;
    if (text && chatId && text.toLowerCase().startsWith('/start')) {
      const welcome = 'Welcome to BETRIX — use /menu to explore.';
      try {
        await sendTelegram('sendMessage', { chat_id: chatId, text: welcome });
      } catch (e) {
        console.debug('sendMessage error', e && e.message || e);
      }
      return { statusCode: 200, body: 'OK' };
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('webhook.handler error', err && err.stack || err);
    return { statusCode: 500, body: 'Server error' };
  }
};
