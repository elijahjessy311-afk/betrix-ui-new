const axios = require("axios");
// Injected by hotfix: use TELEGRAM_BOT_TOKEN from env
const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
const apiMethod = 'sendMessage';
module.exports = async function handleTelegram(payload, cfg = {}) {
  try {
    const BOT_TOKEN = cfg.BOT_TOKEN || process.env.BOT_TOKEN;
    const OPENAI_API_KEY = cfg.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!BOT_TOKEN || !payload || !payload.message || !payload.message.chat || !payload.message.text) {
      console.warn("?? Missing bot token or invalid payload");
      return;
    }

    const chatId = payload.message.chat.id;
    const text = payload.message.text.trim();
    console.log("?? Telegram message received:", text);

    let reply = "?? BETRIX bot is live ?";

    if (text === "/ping") {
      reply = "?? BETRIX bot is live ?";
    } else if (OPENAI_API_KEY) {
      try {
        const r = await axios.post("https://api.openai.com/v1/chat/completions", {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a concise, betting-safe assistant for BETRIX." },
            { role: "user", content: text }
          ],
          max_tokens: 200
        }, {
          headers: { Authorization: "Bearer " + OPENAI_API_KEY }
        });
        reply = r.data.choices?.[0]?.message?.content || reply;
      } catch (e) {
        console.error("? OpenAI error:", e.response?.data || e.message);
        reply = "?? AI reply failed. Try again later.";
      }
    }

    const sendUrl = `https://api.telegram.org/bot${token}/${apiMethod}`;
    const sendPayload = { chat_id: chatId, text: reply };
    const sendResp = await axios.post(sendUrl, sendPayload);
    console.log("? Telegram reply sent:", sendResp.data);
  } catch (err) {
    console.error("? Telegram handler error:", err.stack || err.message || err);
  }
};




