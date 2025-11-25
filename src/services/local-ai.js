import fetch from "node-fetch";
import { Logger } from "../utils/logger.js";

const logger = new Logger("LocalAI");

class LocalAIService {
  constructor() {
    this.name = "LocalAI";
  }

  // Chat: tries DuckDuckGo Instant Answer (no API key), then falls back to canned responses
  async chat(userMessage, context = {}) {
    try {
      const q = encodeURIComponent(userMessage.replace(/\s+/g, " ").trim());
      const url = `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, { timeout: 8000 });
      if (!res.ok) {
        throw new Error(`DDG fetch ${res.status}`);
      }

      const data = await res.json();
      // Try abstract text first
      const abstract = data?.AbstractText || "";
      if (abstract && abstract.length > 10) {
        logger.info("DuckDuckGo instant answer used");
        return abstract;
      }

      // Try related topics
      if (Array.isArray(data?.RelatedTopics) && data.RelatedTopics.length > 0) {
        const first = data.RelatedTopics[0];
        const txt = first?.Text || first?.Result || "";
        if (txt && txt.length > 0) return txt;
      }

      // No good external answer; use built-in fallback
      return this.fallbackResponse(userMessage, context);
    } catch (err) {
      logger.warn("LocalAI remote lookup failed, using fallback", err?.message || String(err));
      return this.fallbackResponse(userMessage, context);
    }
  }

  // Lightweight analysis stub (returns template)
  async analyzeSport(sport, matchData, question) {
    return `Analysis for ${sport}: I don't have full model access here, but based on the data you provided: ${JSON.stringify(matchData).slice(0, 400)}... For detailed analysis you can ask specific questions like 'who's favored' or 'what's the form'.`;
  }

  fallbackResponse(message, context = {}) {
    const msg = String(message || "").toLowerCase();
    if (msg.includes("who are you") || msg.includes("what are you") || msg.includes("your name")) {
      return `👋 I'm BETRIX (local fallback) — a compact AI assistant. I can answer simple questions, fetch quick facts, and run built-in sports helpers. Use /menu for commands.`;
    }

    if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
      return `👋 Hi! I'm BETRIX. Ask about matches, odds, or /menu to see commands.`;
    }

    const keywords = {
      live: "🔴 Use /live to see matches happening now.",
      odds: "🎲 Use /odds [fixture-id] to compare betting lines.",
      standings: "📊 Use /standings to view league tables.",
      predict: "🧠 Ask for a specific match and I'll provide a heuristic prediction.",
      tips: "💡 Bankroll discipline beats luck. Bet responsibly.",
      help: "📚 Use /menu to explore features and commands.",
    };

    for (const k of Object.keys(keywords)) {
      if (msg.includes(k)) return keywords[k];
    }

    return `I'm BETRIX (fallback). I can help with football insights and short facts. Try /menu or ask about a specific match.`;
  }

  isHealthy() {
    return true; // always available
  }
}

export { LocalAIService };
