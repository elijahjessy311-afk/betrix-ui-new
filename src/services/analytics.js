/**
 * Lightweight analytics for betting: implied probability, Kelly fraction, simple model
 */
import { Logger } from '../utils/logger.js';

const logger = new Logger('Analytics');

function decimalToImplied(odd) {
  // odd can be string or number (decimal odds)
  const o = Number(String(odd).replace(/[^0-9.]/g, ''));
  if (!o || o <= 1) return null;
  return 1 / o;
}

function kellyFraction(p, b) {
  // p = probability (0..1), b = decimal-1 (edge units)
  if (b <= 0) return 0;
  const f = (p * (b + 1) - 1) / b; // fractional Kelly
  return Math.max(0, Math.min(1, f || 0));
}

// Simple estimator combining standings points and basic home advantage
function simpleModelProbability(homePointsPerGame, awayPointsPerGame, homeAdv = 0.06) {
  // Convert to relative strength
  const h = homePointsPerGame || 0.5;
  const a = awayPointsPerGame || 0.5;
  const raw = (h * (1 + homeAdv)) / (h * (1 + homeAdv) + a);
  return Math.max(0.01, Math.min(0.99, raw));
}

async function predictMatch({ home, away, homeOdds = null, _awayOdds = null, homePtsPerGame = null, awayPtsPerGame = null }) {
  try {
    // Estimate model probability using points per game if available
    const pHome = simpleModelProbability(homePtsPerGame, awayPtsPerGame);

    // If odds provided, compute implied
    const impliedHome = homeOdds ? decimalToImplied(homeOdds) : null;
    const edge = impliedHome ? pHome - impliedHome : null;

    const b = homeOdds ? Number(homeOdds) - 1 : null;
    const kelly = (edge && b) ? kellyFraction(pHome, b) : 0;

    return {
      home,
      away,
      modelProbHome: Number((pHome).toFixed(3)),
      impliedHome: impliedHome ? Number(impliedHome.toFixed(3)) : null,
      edge: edge ? Number(edge.toFixed(3)) : null,
      kellyFraction: Number(kelly.toFixed(3)),
      recommended: kelly > 0.02 ? `Bet ${Math.round(kelly * 100)}% of bankroll on ${home}` : 'No clear value bet',
    };
  } catch (err) {
    logger.warn('predictMatch failed', err?.message || String(err));
    return null;
  }
}

export { decimalToImplied, kellyFraction, simpleModelProbability, predictMatch };

class AnalyticsService {
  constructor(redis) {
    this.redis = redis;
  }

  /**
   * Track prediction for accuracy scoring
   */
  async trackPrediction(userId, matchId, prediction, confidence = 0.75) {
    try {
      const key = `predictions:${userId}:${matchId}`;
      await this.redis.setex(
        key,
        86400 * 30, // 30 days
        JSON.stringify({ prediction, confidence, timestamp: Date.now() })
      );

      // Track user accuracy
      await this.redis.hincrby(`user:${userId}:stats`, "predictions", 1);
      await this.redis.hincrby(
        `user:${userId}:stats`,
        `confidence_${Math.floor(confidence * 10)}`,
        1
      );
    } catch (err) {
      logger.warn("Prediction tracking failed", err);
    }
  }

  /**
   * Get user accuracy stats
   */
  async getUserStats(userId) {
    try {
      const stats = await this.redis.hgetall(`user:${userId}:stats`);
      return {
        totalPredictions: parseInt(stats.predictions || 0),
        highConfidence: parseInt(stats.confidence_10 || 0),
        mediumConfidence: parseInt(stats.confidence_5 || 0),
        lastActive: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn("Get stats failed", err);
      return {};
    }
  }

  /**
   * Track command usage
   */
  async trackCommand(cmd, userId, duration) {
    try {
      const key = `command:${cmd}`;
      await this.redis.hincrby(key, "count", 1);
      await this.redis.hincrby(key, "totalTime", duration);
      await this.redis.expire(key, 86400 * 30);
    } catch (err) {
      logger.warn("Command tracking failed", err);
    }
  }

  /**
   * Get most used commands
   */
  async getTopCommands(limit = 10) {
    try {
      const keys = await this.redis.keys("command:*");
      const stats = await Promise.all(keys.map(k => this.redis.hgetall(k)));

      return keys
        .map((k, i) => ({
          command: k.replace("command:", ""),
          count: parseInt(stats[i].count || 0),
          avgTime: Math.round(
            parseInt(stats[i].totalTime || 0) / parseInt(stats[i].count || 1)
          ),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (err) {
      logger.warn("Get top commands failed", err);
      return [];
    }
  }

  /**
   * Track user engagement
   */
  async trackEngagement(userId, action, value = 1) {
    try {
      const key = `engagement:${userId}`;
      await this.redis.hincrby(key, action, value);
      await this.redis.expire(key, 86400 * 90); // 90 days
    } catch (err) {
      logger.warn("Engagement tracking failed", err);
    }
  }

  /**
   * Get system health metrics
   */
  async getHealthMetrics() {
    try {
      const info = await this.redis.info("stats");
      const totalUsers = await this.redis.zcard("users:active");

      return {
        totalUsers,
        timestamp: new Date().toISOString(),
        uptime: info ? "healthy" : "degraded",
      };
    } catch (err) {
      logger.error("Health check failed", err);
      return { status: "error" };
    }
  }
}

export { AnalyticsService };
