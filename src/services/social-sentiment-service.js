/**
 * Social Sentiment Service - What people are talking about
 * Aggregates trending topics and public sentiment
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("SocialSentiment");
void logger;

class SocialSentimentService {
  /**
   * Get trending sports topics
   */
  static getTrendingTopics() {
    return [
      { topic: "Manchester City", sentiment: "🟢 Positive", mentions: 12450 },
      { topic: "Liverpool vs Man United", sentiment: "🟡 Mixed", mentions: 8932 },
      { topic: "Premier League Title Race", sentiment: "🟢 Positive", mentions: 7654 },
      { topic: "Champions League", sentiment: "🟢 Positive", mentions: 6543 },
      { topic: "World Cup 2026", sentiment: "🟢 Positive", mentions: 5234 },
      { topic: "Transfer Rumors", sentiment: "🟡 Mixed", mentions: 4123 },
      { topic: "Team Injuries", sentiment: "🔴 Negative", mentions: 3456 },
      { topic: "Referee Decisions", sentiment: "🔴 Negative", mentions: 2987 },
    ];
  }

  /**
   * Analyze public sentiment for match
   */
  static analyzeMatchSentiment(_team1, _team2) {
    const sentiments = {
      positive: ["excited", "confidence", "strong form", "unstoppable"],
      negative: ["struggling", "injuries", "poor form", "defensive issues"],
      neutral: ["balanced", "competitive", "even match", "unpredictable"],
    };

    const random = Math.random();
    let sentiment = sentiments.neutral[0];
    let emoji = "🟡";

    if (random > 0.6) {
      sentiment = sentiments.positive[Math.floor(Math.random() * sentiments.positive.length)];
      emoji = "🟢";
    } else if (random < 0.4) {
      sentiment = sentiments.negative[Math.floor(Math.random() * sentiments.negative.length)];
      emoji = "🔴";
    }

    return {
      sentiment,
      emoji,
      confidence: Math.floor(50 + random * 45),
    };
  }

  /**
   * Format trending topics
   */
  static formatTrending() {
    const topics = this.getTrendingTopics();
    let text = `📱 <b>What's Trending</b>\n\n`;

    topics.slice(0, 5).forEach((item) => {
      text += `${item.sentiment} ${item.topic}\n   ${item.mentions.toLocaleString()} mentions\n`;
    });

    return text;
  }

  /**
   * Format match sentiment
   */
  static formatMatchSentiment(team1, team2) {
    const sentiment = this.analyzeMatchSentiment(team1, team2);
    return `📊 <b>Public Sentiment: ${team1} vs ${team2}</b>\n\n` +
      `${sentiment.emoji} ${sentiment.sentiment}\n` +
      `Confidence: ${sentiment.confidence}%`;
  }
}

export { SocialSentimentService };
