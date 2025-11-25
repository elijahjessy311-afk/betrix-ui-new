/**
 * Gemini AI Service with comprehensive fallbacks
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Logger } from "../utils/logger.js";

const logger = new Logger("Gemini");

class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.enabled = !!apiKey;
    this.disabledByError = false; // flip to true if we detect an unrecoverable API/model error
    if (this.enabled) {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
      } catch (err) {
        logger.error('Failed to initialize GoogleGenerativeAI', err);
        this.enabled = false;
      }
    }
  }

  async chat(userMessage, context = {}) {
    if (!this.enabled) {
      return this.fallbackResponse(userMessage, context);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemPrompt = `You are BETRIX - a world-class autonomous sports AI assistant.

IDENTITY:
- Your name is BETRIX (not Gemini, not ChatGPT)
- You are an independent AI sports analyst
- You have a personality: witty, knowledgeable, confident

PERSONALITY:
- Honest, data-driven, helpful, no hype
- Conversational and friendly
- Explain things clearly to both beginners and experts
- Use sports metaphors when appropriate
- Be encouraging about smart betting practices

SPECIALTY:
- Football (soccer) - leagues, teams, players, odds, predictions
- Betting analysis - value finding, odds comparison, risk management
- Match insights - team form, head-to-head, tactical analysis
- Betting strategy - bankroll management, unit sizing, Kelly Criterion

STYLE:
- Concise but informative (keep responses under 500 chars when natural)
- Professional but friendly (not robotic)
- Use emojis sparingly for emphasis
- Provide data-backed insights
- Ask clarifying questions if needed

USER CONTEXT: ${JSON.stringify(context)}

IMPORTANT:
- Always identify yourself as BETRIX when asked
- Never pretend to be a human or another AI
- Be honest about your capabilities and limitations
- Guide users to /menu or specific commands when appropriate
- Encourage responsible betting practices

Now respond to the user's message with intelligence and personality.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nUser: " + userMessage }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      });

      const text = result.response.text();
      logger.info("Gemini response generated");
      return text;
    } catch (error) {
      // If we detect a 404 / model-not-found error, disable Gemini to avoid log spam
      const msg = String(error?.message || "");
      logger.error("Gemini error", error);
      if (!this.disabledByError && (msg.includes("404 Not Found") || msg.includes("not found") || msg.includes("models/gemini"))) {
        logger.error("Disabling Gemini service due to unrecoverable model/API error (fallback enabled)");
        this.disabledByError = true;
        this.enabled = false;
      }

      return this.fallbackResponse(userMessage, context);
    }
  }

  fallbackResponse(message, context = {}) {
    const msg = message.toLowerCase();

    // Check if user is asking about BETRIX identity
    if (msg.includes("who are you") || msg.includes("what are you") || msg.includes("your name")) {
      return `👋 I'm BETRIX - your autonomous AI sports analyst. I analyze football, odds, betting strategy, and match insights. Ask me anything about sports! Or use /menu to explore.`;
    }

    if (msg.includes("gemini") || msg.includes("chatgpt")) {
      return `I'm BETRIX, not Gemini or ChatGPT. I'm a specialized sports AI built for betting analysis and predictions. How can I help with football or betting?`;
    }

    const keywords = {
      live: "🔴 Use /live to see matches happening now.",
      odds: "🎲 Use /odds [fixture-id] to compare betting lines.",
      standing: "📊 Use /standings to view league tables.",
      predict: "🧠 I analyze form + odds. Ask about a specific match!",
      analysis: "🔍 Describe a match and I'll analyze it.",
      tip: "💡 Bankroll discipline beats luck every time.",
      price: "💵 Type /pricing to see our subscription plans.",
      refer: "👥 Share your code with /refer and earn rewards.",
      help: "📚 Use /menu to explore all features.",
      hi: "👋 Hi! I'm BETRIX. Ask me about football or use /menu.",
      hello: "👋 Hi! I'm BETRIX, your AI sports analyst. What can I help with?",
      hey: "👋 Hey! I'm BETRIX. Ask me about football, odds, or betting strategy!",
    };

    for (const [key, response] of Object.entries(keywords)) {
      if (msg.includes(key)) return response;
    }

    return `I'm BETRIX, your AI sports analyst. I can help with football analysis, odds comparison, and betting strategy. Try /menu or ask me about a specific match!`;
  }

  async analyzeSport(sport, matchData, question) {
    if (!this.enabled) {
      return `Unable to analyze. Try again or use /help.`;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Analyze this ${sport}: ${JSON.stringify(matchData)}\nQuestion: ${question}\nProvide: insights, prediction, confidence.`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 300 },
      });

      return result.response.text();
    } catch (err) {
      logger.error("Analysis error", err);
      return `Unable to analyze right now. Try again later.`;
    }
  }

  isHealthy() {
    return this.enabled;
  }
}

export { GeminiService };
