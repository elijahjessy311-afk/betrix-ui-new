/**
 * Multi-Sport Handler (StatPal removed)
 * Routes all multi-sport requests to SportsAggregator (SportMonks / Football-Data only).
 */

const SportsAggregator = require('./sports-aggregator');
const logger = require('../utils/logger');

class MultiSportHandler {
  constructor(redis = null) {
    this.redis = redis;
    this.aggregator = new SportsAggregator(redis);
  }

  async getLive(sport, options = {}) {
    try {
      return await this.aggregator.getLive(sport, options);
    } catch (err) {
      logger.warn(`MultiSportHandler.getLive error: ${err.message}`);
      return [];
    }
  }

  async getOdds(sport, options = {}) {
    try {
      return await this.aggregator.getOdds(sport, options);
    } catch (err) {
      logger.warn(`MultiSportHandler.getOdds error: ${err.message}`);
      return [];
    }
  }

  async getFixtures(sport, options = {}) {
    try {
      return await this.aggregator.getFixtures(sport, options);
    } catch (err) {
      logger.warn(`MultiSportHandler.getFixtures error: ${err.message}`);
      return [];
    }
  }

  async getStandings(sport, league = null, options = {}) {
    try {
      return await this.aggregator.getStandings(sport, league, options);
    } catch (err) {
      logger.warn(`MultiSportHandler.getStandings error: ${err.message}`);
      return [];
    }
  }

  async getPlayerStats(sport, playerId, options = {}) {
    try {
      if (typeof this.aggregator.getPlayerStats === 'function') {
        return await this.aggregator.getPlayerStats(sport, playerId, options);
      }
      return null;
    } catch (err) {
      logger.warn(`MultiSportHandler.getPlayerStats error: ${err.message}`);
      return null;
    }
  }

  async getTeamStats(sport, teamId, options = {}) {
    try {
      if (typeof this.aggregator.getTeamStats === 'function') {
        return await this.aggregator.getTeamStats(sport, teamId, options);
      }
      return null;
    } catch (err) {
      logger.warn(`MultiSportHandler.getTeamStats error: ${err.message}`);
      return null;
    }
  }

  async getInjuries(sport, options = {}) {
    try {
      if (typeof this.aggregator.getInjuries === 'function') {
        return await this.aggregator.getInjuries(sport, options);
      }
      return [];
    } catch (err) {
      logger.warn(`MultiSportHandler.getInjuries error: ${err.message}`);
      return [];
    }
  }

  async getPlayByPlay(sport, matchId, options = {}) {
    try {
      if (typeof this.aggregator.getPlayByPlay === 'function') {
        return await this.aggregator.getPlayByPlay(sport, matchId, options);
      }
      return [];
    } catch (err) {
      logger.warn(`MultiSportHandler.getPlayByPlay error: ${err.message}`);
      return [];
    }
  }

  async getLiveMatchStats(sport, matchId, options = {}) {
    try {
      if (typeof this.aggregator.getLiveMatchStats === 'function') {
        return await this.aggregator.getLiveMatchStats(sport, matchId, options);
      }
      return null;
    } catch (err) {
      logger.warn(`MultiSportHandler.getLiveMatchStats error: ${err.message}`);
      return null;
    }
  }

  async getResults(sport, options = {}) {
    try {
      if (typeof this.aggregator.getResults === 'function') {
        return await this.aggregator.getResults(sport, options);
      }
      return [];
    } catch (err) {
      logger.warn(`MultiSportHandler.getResults error: ${err.message}`);
      return [];
    }
  }

  async getScoringLeaders(sport, options = {}) {
    try {
      if (typeof this.aggregator.getScoringLeaders === 'function') {
        return await this.aggregator.getScoringLeaders(sport, options);
      }
      return [];
    } catch (err) {
      logger.warn(`MultiSportHandler.getScoringLeaders error: ${err.message}`);
      return [];
    }
  }

  async getRoster(sport, teamId, options = {}) {
    try {
      if (typeof this.aggregator.getRoster === 'function') {
        return await this.aggregator.getRoster(sport, teamId, options);
      }
      return [];
    } catch (err) {
      logger.warn(`MultiSportHandler.getRoster error: ${err.message}`);
      return [];
    }
  }

  async getAllSportsLive(options = {}) {
    try {
      if (typeof this.aggregator.getAllSportsLive === 'function') {
        return await this.aggregator.getAllSportsLive(options);
      }

      // Fallback: call getLive for default sports list
      const sports = options.sports || ['soccer', 'nfl', 'nba', 'nhl', 'mlb', 'cricket', 'tennis'];
      const results = {};
      for (const sport of sports) {
        const data = await this.getLive(sport, options);
        results[sport] = { count: Array.isArray(data) ? data.length : 0, matches: data };
      }
      return results;
    } catch (err) {
      logger.error(`MultiSportHandler.getAllSportsLive fatal: ${err.message}`);
      return {};
    }
  }

  async healthCheck() {
    // Since StatPal is removed, report aggregated provider health if available
    try {
      if (typeof this.aggregator.healthCheck === 'function') {
        return await this.aggregator.healthCheck();
      }
      return { provider: 'Aggregator', status: 'unknown', timestamp: new Date().toISOString() };
    } catch (err) {
      logger.warn(`MultiSportHandler.healthCheck error: ${err.message}`);
      return { provider: 'Aggregator', status: 'unhealthy', timestamp: new Date().toISOString(), error: err.message };
    }
  }

  static getAvailableSports() {
    if (typeof SportsAggregator.getAvailableSports === 'function') {
      return SportsAggregator.getAvailableSports();
    }
    return [];
  }
}

module.exports = MultiSportHandler;
