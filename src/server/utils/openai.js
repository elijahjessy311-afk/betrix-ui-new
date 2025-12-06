const fetch = globalThis.fetch || require("node-fetch");
const axios = require("axios");

// Telemetry counters (in-memory)
const telemetry = {
  totalRequests: 0,
  rapidSuccess: 0,
  rapidErrors: 0,
  hfSuccess: 0,
  hfErrors: 0,
  openRouterErrors: 0,
  openAiErrors: 0,
  stubFallbacks: 0,
  lastError: null,
};

const RAPID_HOST = "open-ai21.p.rapidapi.com";
const RAPID_PATH = "/conversationllama";

const OPEN_ROUTER_KEY = process.env.OPEN_ROUTER_KEY || null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const HUGGING_FACE_KEY = process.env.HUGGING_FACE_KEY || null;
const USE_STUB_AI = (process.env.USE_STUB_AI || "false").toLowerCase() === "true";
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);

// Simple stub replies
function stubReply(prompt) {
  const t = (prompt || "").toString().toLowerCase();
  if (!t) return "I didn't get that. Ask me about fixtures, odds, or tips.";
  if (/\bhello|hi|hey\b/.test(t)) return "Hello! BETRIX here � limited mode (stub). Ask about odds or fixtures.";
  if (/\bping\b/.test(t)) return "pong (stub)";
  if (/\b(odds|fixture|match|score)\b/.test(t)) return "Stubbed matches: Team A vs Team B; Team C vs Team D.";
  return "BETRIX (stub): I'm currently running in fallback mode. Set OPEN_ROUTER_KEY or RAPID_API_KEY to enable live AI.";
}

// RapidAPI Llama call
async function callRapidLlama(prompt) {
  const key = process.env.RAPID_API_KEY;
  if (!key) throw new Error("RAPID_API_KEY missing");
  const url = `https://${RAPID_HOST}${RAPID_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": RAPID_HOST,
      "x-rapidapi-key": key,
    },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }], web_access: false }),
    timeout: 30000,
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>"");
    const err = new Error(`RapidAPI ${res.status}: ${txt}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json().catch(()=>({}));
  const reply = json?.result || json?.text || (json?.choices && json.choices[0]?.message?.content) || JSON.stringify(json);
  return String(reply);
}

// Hugging Face fallback
async function callHuggingFace(prompt) {
  const key = HUGGING_FACE_KEY || process.env.HUGGING_FACE_KEY;
  if (!key) throw new Error("HUGGING_FACE_KEY missing");
  const res = await fetch("https://api-inference.huggingface.co/models/distilgpt2", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: prompt }),
    timeout: 30000,
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>"");
    const err = new Error(`HuggingFace ${res.status}: ${txt}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json().catch(()=>({}));
  const text = (Array.isArray(json) && json[0]?.generated_text) || json?.generated_text || JSON.stringify(json);
  return String(text);
}

// OpenRouter (optional)
async function callOpenRouter(prompt, opts = {}) {
  if (!OPEN_ROUTER_KEY) throw new Error("OPEN_ROUTER_KEY missing");
  const model = opts.model || "gpt-4o-mini";
  const max_tokens = opts.max_tokens || 400;
  const url = "https://api.openrouter.ai/v1/completions";
  const body = { model, input: prompt, max_tokens };
  const headers = { Authorization: `Bearer ${OPEN_ROUTER_KEY}`, "Content-Type": "application/json" };
  const resp = await axios.post(url, body, { headers, timeout: 15000 });
  const text = resp?.data?.choices?.[0]?.message?.content || resp?.data?.result || JSON.stringify(resp?.data);
  return String(text);
}

// OpenAI (optional)
async function callOpenAI(prompt, opts = {}) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const model = opts.model || "gpt-3.5-turbo";
  const max_tokens = opts.max_tokens || 400;
  const url = "https://api.openai.com/v1/chat/completions";
  const body = { model, messages: [{ role: "user", content: prompt }], max_tokens };
  const headers = { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" };
  const resp = await axios.post(url, body, { headers, timeout: 15000 });
  const text = resp?.data?.choices?.[0]?.message?.content || JSON.stringify(resp?.data);
  return String(text);
}

// ask(prompt) unified with retry and fallbacks
async function ask(prompt, opts = {}) {
  telemetry.totalRequests += 1;

  if (USE_STUB_AI) {
    telemetry.stubFallbacks += 1;
    return { ok: true, text: stubReply(prompt) };
  }

  // Prefer RapidAPI if key present
  if (process.env.RAPID_API_KEY) {
    try {
      const t0 = Date.now(); void t0;
      const text = await callRapidLlama(prompt);
      telemetry.rapidSuccess += 1;
      return { ok: true, text };
    } catch (err) {
      telemetry.rapidErrors += 1;
      telemetry.lastError = String(err && (err.message || err.status || err));
      // one retry after small backoff
      try { await new Promise(r => setTimeout(r, 400)); const text2 = await callRapidLlama(prompt); telemetry.rapidSuccess += 1; return { ok: true, text: text2 }; } catch (err2) { telemetry.rapidErrors += 1; telemetry.lastError = String(err2 && (err2.message || err2.status || err2)); }
      // fallthrough to Hugging Face
    }
  }

  if (HUGGING_FACE_KEY || process.env.HUGGING_FACE_KEY) {
    try {
      const text = await callHuggingFace(prompt);
      telemetry.hfSuccess += 1;
      return { ok: true, text };
    } catch (err) {
      telemetry.hfErrors += 1;
      telemetry.lastError = String(err && (err.message || err.status || err));
    }
  }

  if (OPEN_ROUTER_KEY) {
    try {
      const text = await callOpenRouter(prompt, opts);
      return { ok: true, text };
    } catch (err) {
      telemetry.openRouterErrors += 1;
      telemetry.lastError = String(err && (err.message || err.status || err));
    }
  }

  if (OPENAI_API_KEY) {
    try {
      const text = await callOpenAI(prompt, opts);
      return { ok: true, text };
    } catch (err) {
      telemetry.openAiErrors += 1;
      telemetry.lastError = String(err && (err.message || err.status || err));
      return { ok: false, error: "ai-provider-failed" };
    }
  }

  telemetry.stubFallbacks += 1;
  return { ok: true, text: stubReply(prompt) };
}

// Simple in-memory rate limiter middleware (Express)
const rateMap = new Map(); // chatId -> {count, tsWindow}
function rateLimiter(req, res, next) {
  try {
    const chatId = req.body?.message?.chat?.id || req.body?.chat?.id;
    if (!chatId) return next();
    const now = Date.now();
    const winMs = 60_000;
    const st = rateMap.get(chatId) || { count: 0, tsWindow: now };
    if (now - st.tsWindow > winMs) { st.count = 0; st.tsWindow = now; }
    st.count += 1;
    rateMap.set(chatId, st);
    if (st.count > RATE_LIMIT_PER_MINUTE) return res.status(429).send({ ok: false, error: "rate_limited" });
    return next();
  } catch (e) {
    return next();
  }
}

// Admin handler to expose telemetry
async function adminHandler(req, res) {
  res.json({ ok: true, telemetry });
}

module.exports = { ask, rateLimiter, adminHandler, telemetry };
