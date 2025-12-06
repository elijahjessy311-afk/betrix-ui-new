/**
 * Trending Bets Service - Popular betting strategies
 * No API required
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("TrendingBets");
void logger;

class TrendingBetsService {
  static TRENDING = [
    {
      name: "Correct Score",
      popularity: 85,
      description: "Predict exact final score",
      roi: "3.2x",
    },
    {
      name: "Both Teams Score",
      popularity: 78,
      description: "Both teams will score in the match",
      roi: "1.8x",
    },
    {
      name: "Over 2.5 Goals",
      popularity: 92,
      description: "More than 2.5 goals in the match",
      roi: "1.6x",
    },
    {
      name: "First Goal Scorer",
      popularity: 65,
      description: "Predict who scores first",
      roi: "4.5x",
    },
    {
      name: "Handicap Betting",
      popularity: 72,
      description: "Team + goal advantage/disadvantage",
      roi: "1.9x",
    },
    {
      name: "Corner Betting",
      popularity: 55,
      description: "Predict total corners or team corners",
      roi: "2.1x",
    },
    {
      name: "Parlay Chains",
      popularity: 88,
      description: "Multiple predictions in one bet",
      roi: "5.0x+",
    },
    {
      name: "Live Betting",
      popularity: 95,
      description: "Bet during live match",
      roi: "2.3x",
    },
  ];

  /**
   * Get trending bet types
   */
  static getTrendingBets() {
    return this.TRENDING.sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Get recommendation
   */
  static getRecommendation() {
    const recommended = this.TRENDING.filter((b) => b.popularity > 70);
    return recommended[Math.floor(Math.random() * recommended.length)];
  }

  /**
   * Format trending
   */
  static formatTrending() {
    let text = `📊 <b>Trending Bet Types</b>\n\n`;

    this.getTrendingBets().slice(0, 5).forEach((b) => {
      const bar = "█".repeat(Math.floor(b.popularity / 20)) + "░".repeat(5 - Math.floor(b.popularity / 20));
      text += `<b>${b.name}</b> ${bar} ${b.popularity}%\n`;
      text += `   ${b.description}\n`;
      text += `   ROI: ${b.roi}\n\n`;
    });

    return text;
  }

  /**
   * Format recommendation
   */
  static formatRecommendation() {
    const rec = this.getRecommendation();
    return `💡 <b>Bet Type Recommendation</b>\n\n` +
      `🎯 ${rec.name}\n` +
      `${rec.description}\n\n` +
      `Average ROI: ${rec.roi}\n` +
      `Popularity: ${rec.popularity}%`;
  }
}

export { TrendingBetsService };
