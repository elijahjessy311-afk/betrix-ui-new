/**
 * StatPal Multi-Sport Handler
 * Handles all sports data requests via StatPal API:
 * - Soccer/Football
 * - American Football (NFL)
 * - Basketball (NBA)
 * - Ice Hockey (NHL)
 * - Baseball (MLB)
 * - Cricket
 * - Tennis
 * - Esports
 * - Formula 1 (F1)
 * - Handball
 * - Golf
 * - Horse Racing
 * - Volleyball
 * 
 * Provides live scores, odds, fixtures, standings, and player/team stats for all sports
 */

const CONFIG = require('../config');
const StatPalService = require('./statpal-service');
const logger = require('../utils/logger');

class MultiSportHandler {
  constructor(redis = null) {
    this.statpal = new StatPalService(redis);
    this.redis = redis;
  }

  /**
   * Get live matches for any sport
   * @param {string} sport - Sport name (soccer, nfl, nba, nhl, mlb, cricket, tennis, f1, esports, etc.)
   * @param {Object} options - Options {version: 'v1' or 'v2', limit: number}
   */
  async getLive(sport, options = {}) {
    const { version = 'v1', limit = 50 } = options;
    
    logger.info(`📊 Fetching live ${sport} matches via StatPal (${version})`);
    
    const data = await this.statpal.getLiveScores(sport, version);
    
    if (!data) {
      logger.warn(`No live ${sport} data available`);
      return [];
    }

    const matches = Array.isArray(data) ? data : (data.data || []);
    return matches.slice(0, limit);
  }

  /**
   * Get odds for any sport
   * @param {string} sport - Sport name
   * @param {Object} options - Options {version: 'v1' or 'v2', limit: number}
   */
  async getOdds(sport, options = {}) {
    const { version = 'v1', limit = 50 } = options;
    
    logger.info(`💰 Fetching ${sport} odds via StatPal (${version})`);
    
    const data = await this.statpal.getLiveOdds(sport, version);
    
    if (!data) {
      logger.warn(`No ${sport} odds available`);
      return [];
    }

    const odds = Array.isArray(data) ? data : (data.data || []);
    return odds.slice(0, limit);
  }

  /**
   * Get upcoming fixtures for any sport
   * @param {string} sport - Sport name
   * @param {Object} options - Options {version: 'v1' or 'v2', limit: number, days: number}
   */
  async getFixtures(sport, options = {}) {
    const { version = 'v1', limit = 50, days = 7 } = options;
    
    logger.info(`📅 Fetching ${sport} fixtures (next ${days} days) via StatPal`);
    
    const data = await this.statpal.getFixtures(sport, version);
    
    if (!data) {
      logger.warn(`No ${sport} fixtures available`);
      return [];
    }

    const fixtures = Array.isArray(data) ? data : (data.data || []);
    return fixtures.slice(0, limit);
  }

  /**
   * Get standings for a sport
   * @param {string} sport - Sport name
   * @param {string} league - League ID or code (optional)
   * @param {Object} options - Options {version: 'v1' or 'v2'}
   */
  async getStandings(sport, league = null, options = {}) {
    const { version = 'v1' } = options;
    
    logger.info(`🏆 Fetching ${sport} standings${league ? ` for ${league}` : ''} via StatPal`);
    
    const data = await this.statpal.getStandings(sport, league, version);
    
    if (!data) {
      logger.warn(`No ${sport} standings available`);
      return [];
    }

    return Array.isArray(data) ? data : (data.data || []);
  }

  /**
   * Get player statistics
   * @param {string} sport - Sport name
   * @param {string} playerId - Player ID
   * @param {Object} options - Options {version: 'v1' or 'v2'}
   */
  async getPlayerStats(sport, playerId, options = {}) {
    const { version = 'v1' } = options;
    
    logger.info(`👤 Fetching ${sport} player ${playerId} stats via StatPal`);
    
    const data = await this.statpal.getPlayerStats(sport, playerId, version);
    
    if (!data) {
      logger.warn(`No player stats available for ${playerId}`);
      return null;
    }

    return data;
  }

  /**
   * Get team statistics
   * @param {string} sport - Sport name
   * @param {string} teamId - Team ID
   * @param {Object} options - Options {version: 'v1' or 'v2'}
   */
  async getTeamStats(sport, teamId, options = {}) {
    const { version = 'v1' } = options;
    
    logger.info(`🏢 Fetching ${sport} team ${teamId} stats via StatPal`);
    
    const data = await this.statpal.getTeamStats(sport, teamId, version);
    
    if (!data) {
      logger.warn(`No team stats available for ${teamId}`);
      return null;
    }

    return data;
  }

  /**
   * Get injury reports
   * @param {string} sport - Sport name
   * @param {Object} options - Options {version: 'v1' or 'v2', limit: number}
   */
  async getInjuries(sport, options = {}) {
    const { version = 'v1', limit = 50 } = options;
    
    logger.info(`🏥 Fetching ${sport} injury reports via StatPal`);
    
    const data = await this.statpal.getInjuries(sport, version);
    
    if (!data) {
      logger.warn(`No ${sport} injury data available`);
      return [];
    }

    const injuries = Array.isArray(data) ? data : (data.data || []);
    return injuries.slice(0, limit);
  }

  /**
   * Get play-by-play data
   * @param {string} sport - Sport name
   * @param {string} matchId - Match/Game ID
   * @param {Object} options - Options {version: 'v1' or 'v2'}
   */
  async getPlayByPlay(sport, matchId, options = {}) {
    const { version = 'v1' } = options;
    
    logger.info(`▶️ Fetching ${sport} play-by-play for match ${matchId} via StatPal`);
    
    const data = await this.statpal.getLivePlayByPlay(sport, matchId, version);
    
    if (!data) {
      logger.warn(`No play-by-play data available for ${matchId}`);
      return [];
    }

    return Array.isArray(data) ? data : (data.data || []);
  }

  /**
   * Get live match statistics
   * @param {string} sport - Sport name
   * @param {string} matchId - Match/Game ID
   * @param {Object} options - Options {version: 'v1' or 'v2'}
   */
  async getLiveMatchStats(sport, matchId, options = {}) {
    const { version = 'v1' } = options;
    
    logger.info(`📈 Fetching ${sport} live match stats for ${matchId} via StatPal`);
    
    const data = await this.statpal.getLiveMatchStats(sport, matchId, version);
    
    if (!data) {
      logger.warn(`No live match stats available for ${matchId}`);
      return null;
    }

    return data;
  }

  /**
   * Get results (past matches)
   * @param {string} sport - Sport name
   * @param {Object} options - Options {version: 'v1' or 'v2', limit: number, days: number}
   */
  async getResults(sport, options = {}) {
    const { version = 'v1', limit = 50, days = 7 } = options;
    
    logger.info(`📋 Fetching ${sport} results (past ${days} days) via StatPal`);
    
    const data = await this.statpal.getResults(sport, version);
    
    if (!data) {
      logger.warn(`No ${sport} results available`);
      return [];
    }

    const results = Array.isArray(data) ? data : (data.data || []);
    return results.slice(0, limit);
  }

  /**
   * Get scoring leaders for a sport
   * @param {string} sport - Sport name
   * @param {Object} options - Options {version: 'v1' or 'v2', limit: number}
   */
  async getScoringLeaders(sport, options = {}) {
    const { version = 'v1', limit = 20 } = options;
    
    logger.info(`⭐ Fetching ${sport} scoring leaders via StatPal`);
    
    const data = await this.statpal.getScoringLeaders(sport, version);
    
    if (!data) {
      logger.warn(`No ${sport} scoring leaders available`);
      return [];
    }

    const leaders = Array.isArray(data) ? data : (data.data || []);
    return leaders.slice(0, limit);
  }

  /**
   * Get rosters (player lists) for a team
   * @param {string} sport - Sport name
   * @param {string} teamId - Team ID
   * @param {Object} options - Options {version: 'v1' or 'v2'}
   */
  async getRoster(sport, teamId, options = {}) {
    const { version = 'v1' } = options;
    
    logger.info(`📑 Fetching ${sport} roster for team ${teamId} via StatPal`);
    
    const data = await this.statpal.getRosters(sport, teamId, version);
    
    if (!data) {
      logger.warn(`No roster available for ${teamId}`);
      return [];
    }

    return Array.isArray(data) ? data : (data.data || []);
  }

  /**
   * Multi-sport dashboard: Get all live sports at once
   * @param {Object} options - Options {sports: [array], version: 'v1' or 'v2', limit: number}
   */
  async getAllSportsLive(options = {}) {
    const {
      sports = ['soccer', 'nfl', 'nba', 'nhl', 'mlb', 'cricket', 'tennis'],
      version = 'v1',
      limit = 20
    } = options;

    logger.info(`🌍 Fetching live data for ${sports.length} sports via StatPal`);

    const results = {};
    
    for (const sport of sports) {
      try {
        const data = await this.getLive(sport, { version, limit });
        results[sport] = {
          count: data.length,
          matches: data,
          status: 'success'
        };
        logger.info(`✅ ${sport.toUpperCase()}: ${data.length} live matches`);
      } catch (error) {
        logger.error(`❌ ${sport.toUpperCase()} error:`, error.message);
        results[sport] = {
          count: 0,
          matches: [],
          status: 'error',
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Health check - Verify StatPal API is working
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    logger.info('🏥 Starting StatPal health check...');
    
    const isHealthy = await this.statpal.healthCheck();
    
    return {
      provider: 'StatPal',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      message: isHealthy 
        ? 'StatPal API is accessible and working'
        : 'StatPal API is not accessible'
    };
  }

  /**
   * Get available sports
   * @returns {Array<string>} List of supported sports
   */
  static getAvailableSports() {
    return StatPalService.getAvailableSports();
  }
}

module.exports = MultiSportHandler;
