// src/server/routes/webhook-ai.js - OpenRouter-first provider call with stub fallback
const express = require("express");
const axios = require("axios");
const router = express.Router();
const { getProvider } = require("../lib/ai-config");

router.post("/ai-reply", express.json({ limit: "64kb" }), async (req, res) => {
  try {
    const body = req.body || {};
    const convoId = body.convoId || (body.message && body.message.from && String(body.message.from.id)) || `anon-${Date.now()}`;
    const messageText = (body.message && body.message.text) || body.text || "";

    console.info("AI-REPLY incoming", { convoId, textPreview: messageText && messageText.slice(0, 120) });

    // persist hooking points can stay here (Upstash or memory) � omitted for brevity

    const provider = getProvider();
    if (provider.type === "openrouter") {
      // Example OpenRouter call: POST to their completions endpoint
      const orKey = provider.key;
      try {
        const resp = await axios.post(
          "https://api.openrouter.ai/v1/completions",
          {
            model: "gpt-4o-mini", // adjust model name per your OpenRouter plan
            input: messageText,
            max_tokens: 400
          },
          { headers: { Authorization: `Bearer ${orKey}`, "Content-Type": "application/json" }, timeout: 15000 }
        );
        const replyText = resp?.data?.choices?.[0]?.message?.content || resp?.data?.result || "OpenRouter: empty reply";
        return res.json({ ok: true, reply: String(replyText), provider: provider.name });
      } catch (err) {
        console.error("OpenRouter error:", err && err.response ? err.response.status : err && err.message ? err.message : err);
        // fallthrough to stub/responder
      }
    } else if (provider.type === "rapidapi") {
      // RapidAPI placeholder: callers can plug provider-specific call here
      console.warn("Using RapidAPI provider path is not yet implemented; falling back to stub.");
    } else if (provider.type === "openai") {
      console.warn("OpenAI provider configured but OpenRouter preferred; implement OpenAI path if needed.");
    }

    // Stub/responder fallback
    const reply = ruleResponder(messageText);
    return res.json({ ok: true, reply, provider: "stub" });
  } catch (err) {
    console.error("WEBHOOK-AI ERROR", err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: "ai-fallback-error" });
  }
});

// Minimal rule-based responder
function ruleResponder(text) {
  if (!text) return "I didn't get that. Can you rephrase?";
  const t = text.toLowerCase().trim();
  if (/\b(hello|hi|hey)\b/.test(t)) return "Hello! This is BETRIX AI (stub). How can I help you with sports today?";
  if (/\b(odds|fixture|match|score|next match)\b/.test(t)) return "Stubbed matches: Team A vs Team B; Team C vs Team D.";
  if (/\b(recommend|tip|prediction)\b/.test(t)) return "Tip (stub): check recent form and head-to-head. Gamble responsibly.";
  if (t.length < 40) return `You said "${text}". Tell me more and I can help with odds, fixtures, or tips.`;
  return "Thanks for the info � I don't have live AI here, but I can store this and help with fixtures, odds, and subscriptions.";
}

module.exports = router;
