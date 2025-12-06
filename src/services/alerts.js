/**
 * Real-time Alerts System
 * Notify users of live matches, goals, and significant events
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("Alerts");

class AlertsService {
  constructor(redis, telegram) {
    this.redis = redis;
    this.telegram = telegram;
  }

  /**
   * Subscribe user to match alerts
   */
  async subscribeToMatch(userId, fixtureId, _matchInfo) {
    try {
      const key = `alerts:${userId}:matches`;
      await this.redis.sadd(key, fixtureId);
      await this.redis.expire(key, 86400); // 24 hours

      logger.info(`User ${userId} subscribed to fixture ${fixtureId}`);
      return true;
    } catch (err) {
      logger.error("Subscribe failed", err);
      return false;
    }
  }

  /**
   * Unsubscribe from match
   */
  async unsubscribeFromMatch(userId, fixtureId) {
    try {
      const key = `alerts:${userId}:matches`;
      await this.redis.srem(key, fixtureId);
      return true;
    } catch (err) {
      logger.error("Unsubscribe failed", err);
      return false;
    }
  }

  /**
   * Broadcast match event to subscribers
   */
  async broadcastMatchEvent(fixtureId, _event) {
    try {
      const keys = await this.redis.keys(`alerts:*:matches`);
      const subscribers = [];

      for (const key of keys) {
        const userId = key.split(":")[1];
        const hasMatch = await this.redis.sismember(key, fixtureId);
        if (hasMatch) subscribers.push(userId);
      }

      logger.info(`Broadcasting to ${subscribers.length} subscribers`);
      return subscribers.length;
    } catch (err) {
      logger.error("Broadcast failed", err);
      return 0;
    }
  }

  /**
   * Send goal alert
   */
  async alertGoal(userId, chatId, matchInfo, goalInfo) {
    try {
      const message =
        `🔴 GOAL!\n\n` +
        `${matchInfo.home} vs ${matchInfo.away}\n` +
        `⚽ ${goalInfo.scorer} scored!\n` +
        `Score: ${matchInfo.score}`;

      await this.telegram.sendMessage(chatId, message);
    } catch (err) {
      logger.error("Goal alert failed", err);
    }
  }

  /**
   * Send match start alert
   */
  async alertMatchStart(userId, chatId, matchInfo) {
    try {
      const message =
        `🏟️ MATCH STARTING\n\n` +
        `${matchInfo.home} vs ${matchInfo.away}\n` +
        `⏰ Now live!`;

      await this.telegram.sendMessage(chatId, message);
    } catch (err) {
      logger.error("Match start alert failed", err);
    }
  }

  /**
   * Send prediction update
   */
  async alertPredictionUpdate(userId, chatId, prediction) {
    try {
      const message =
        `🎯 Prediction Update\n\n` +
        `Match: ${prediction.match}\n` +
        `Prediction: ${prediction.result}\n` +
        `Confidence: ${Math.round(prediction.confidence * 100)}%`;

      await this.telegram.sendMessage(chatId, message);
    } catch (err) {
      logger.error("Prediction alert failed", err);
    }
  }
}

export { AlertsService };
