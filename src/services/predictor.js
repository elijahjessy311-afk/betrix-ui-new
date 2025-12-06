/**
 * Advanced Match Prediction Engine
 * AI-powered predictions with confidence scoring and form analysis
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("Predictor");

class PredictionEngine {
  constructor(redis, apiFootball, gemini) {
    this.redis = redis;
    this.apiFootball = apiFootball;
    this.gemini = gemini;
  }

  /**
   * Predict match outcome with confidence
   */
  async predictMatch(homeTeam, awayTeam, fixtureData = {}) {
    try {
      const formScore = await this.calculateFormScore(homeTeam, awayTeam);
      const headToHead = await this.getHeadToHead(homeTeam, awayTeam);
      const bookmakerOdds = fixtureData.odds || {};

      // AI prediction
      const aiPrediction = await this.gemini.chat(
        `Predict ${homeTeam} vs ${awayTeam}. Form: ${formScore}. H2H: ${headToHead}. Odds: ${JSON.stringify(bookmakerOdds)}. Give: winner, confidence (0-1), key factors.`,
        {}
      );

      // Parse confidence from AI response
      const confidence = this.extractConfidence(aiPrediction);

      return {
        prediction: aiPrediction,
        confidence: Math.min(0.95, Math.max(0.5, confidence)),
        formScore,
        timestamp: Date.now(),
      };
    } catch (err) {
      logger.error("Prediction failed", err);
      return this.fallbackPrediction(homeTeam, awayTeam);
    }
  }

  /**
   * Calculate team form score (0-100)
   */
  async calculateFormScore(team1, _team2) {
    try {
      // Mock form calculation - in production, use actual match history
      const key = `form:${team1}`;
      const form = await this.redis.get(key);

      if (form) return parseInt(form);

      // Default form score
      return 70;
    } catch (err) {
      return 70;
    }
  }

  /**
   * Head-to-head analysis
   */
  async getHeadToHead(team1, team2) {
    try {
      const key = `h2h:${[team1, team2].sort().join(":")}`;
      const h2h = await this.redis.get(key);

      return h2h ? JSON.parse(h2h) : { matches: 0, team1Wins: 0, team2Wins: 0 };
    } catch {
      return { matches: 0, team1Wins: 0, team2Wins: 0 };
    }
  }

  /**
   * Extract confidence score from AI text
   */
  extractConfidence(text) {
    const matches = text.match(/(\d+(?:\.\d+)?)\s*%|confidence[:\s]+(\d+(?:\.\d+)?)/i);
    if (matches) {
      const value = parseFloat(matches[1] || matches[2]) / 100;
      return Math.min(1, Math.max(0.5, value));
    }
    return 0.75;
  }

  /**
   * Fallback prediction when AI unavailable
   */
  fallbackPrediction(home, away) {
    return {
      prediction: `${home} slightly favored over ${away}. Form and motivation key factors.`,
      confidence: 0.65,
      formScore: 70,
      timestamp: Date.now(),
    };
  }

  /**
   * Get prediction accuracy for user
   */
  async getPredictionAccuracy(userId) {
    try {
      const stats = await this.redis.hgetall(`user:${userId}:pred_stats`);
      const total = parseInt(stats.total || 0);
      const correct = parseInt(stats.correct || 0);

      return total > 0 ? (correct / total).toFixed(2) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Smart recommendation based on user history
   */
  async recommendMatch(userId) {
    try {
      const userStats = await this.redis.hgetall(`user:${userId}:interests`);
      const preferredLeagues = Object.keys(userStats)
        .sort((a, b) => userStats[b] - userStats[a])
        .slice(0, 3);

      // In production, fetch matches from these leagues and rank by predicted accuracy
      return {
        leagues: preferredLeagues,
        recommendation: "Check fixtures in your favorite leagues",
      };
    } catch (err) {
      return { recommendation: "Type /live for today's matches" };
    }
  }
}

export { PredictionEngine };
