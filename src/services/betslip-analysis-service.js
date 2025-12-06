/**
 * Betslip Analysis Service
 * AI-powered analysis before each betslip
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("BetslipAnalysis");

class BetslipAnalysisService {
  constructor(gemini) {
    this.gemini = gemini;
  }

  /**
   * Generate comprehensive betslip analysis
   */
  async analyzeBetslip(slip, userStats = {}) {
    try {
      const matches = slip.matches || [];
      const totalOdds = slip.totalOdds || 1;

      const prompt = `You are BETRIX. Analyze this betslip and explain why it's a STRONG BET:

BETSLIP DETAILS:
${matches.map((m) => `- ${m.team}: ${m.prediction} @ ${m.odds}`).join("\n")}

Total Odds: ${totalOdds}
User Accuracy: ${userStats.accuracy || "Unknown"}%

PROVIDE:
1. Quick verdict (WHY this is a good bet)
2. Risk/Reward assessment
3. Key factors supporting each match
4. One tactical insight
5. Recommended stake (2-3% bankroll)

Be concise, data-driven, confident. Start with emoji.`;

      const analysis = await this.gemini.chat(prompt);
      return analysis;
    } catch (err) {
      logger.error("Analyze betslip failed", err);
      return this.getFallbackAnalysis(slip);
    }
  }

  /**
   * Get match-specific analysis
   */
  async analyzeMatch(matchData) {
    try {
      const prompt = `You are BETRIX sports analyst. Quick analysis of this match:

Match: ${matchData.homeTeam} vs ${matchData.awayTeam}
Form: ${matchData.homeForm || "TBA"} vs ${matchData.awayForm || "TBA"}
Odds: ${matchData.odds || "TBA"}

Provide: 2-sentence prediction with reasoning.`;

      return await this.gemini.chat(prompt);
    } catch (err) {
      logger.error("Analyze match failed", err);
      return `Form-based analysis favoring ${matchData.homeTeam || "home team"}`;
    }
  }

  /**
   * Risk assessment
   */
  assessRisk(totalOdds, _matches) {
    if (totalOdds > 8) {
      return {
        level: "🔴 HIGH",
        emoji: "⚠️",
        message: "High odds = high payout but lower probability. Only if very confident.",
      };
    } else if (totalOdds > 4) {
      return {
        level: "🟠 MEDIUM-HIGH",
        emoji: "📊",
        message: "Decent value bet. Covers your analysis + costs.",
      };
    } else if (totalOdds > 2) {
      return {
        level: "🟡 MEDIUM",
        emoji: "✅",
        message: "Safe bet with good returns. Recommended for building streaks.",
      };
    } else {
      return {
        level: "🟢 LOW",
        emoji: "🛡️",
        message: "Low risk. Good for bankroll building.",
      };
    }
  }

  /**
   * Format analysis for display
   */
  formatAnalysisDisplay(analysis, slip, _userStats) {
    const risk = this.assessRisk(slip.totalOdds, slip.matches);

    let text = `📊 <b>BETSLIP ANALYSIS</b>\n\n`;
    text += `🎯 <b>AI Verdict:</b>\n${analysis}\n\n`;
    text += `${risk.emoji} <b>Risk Level:</b> ${risk.level}\n`;
    text += `${risk.message}\n\n`;
    text += `💰 <b>Stake Calculator:</b>\n`;
    text += `100 → ${(100 * slip.totalOdds).toFixed(0)}\n`;
    text += `500 → ${(500 * slip.totalOdds).toFixed(0)}\n`;
    text += `1000 → ${(1000 * slip.totalOdds).toFixed(0)}\n\n`;
    text += `✅ Ready to place bet?`;

    return text;
  }

  /**
   * Fallback analysis
   */
  getFallbackAnalysis(slip) {
    const matches = slip.matches || [];
    const totalOdds = slip.totalOdds || 1;

    if (matches.length === 1) {
      return `⚽ Single bet with odds ${totalOdds}. Strong fundamental analysis supports this pick. Good value bet for your profile.`;
    } else if (matches.length <= 3) {
      return `🎯 Multi-match parlay (${matches.length}). Combined odds ${totalOdds} offer excellent value. Each match passes form analysis. Recommended for experienced bettors.`;
    } else {
      return `🔥 Large parlay (${matches.length} matches). High odds ${totalOdds}. Only bet if 100% confident in ALL selections. Risk management crucial.`;
    }
  }
}

export { BetslipAnalysisService };
