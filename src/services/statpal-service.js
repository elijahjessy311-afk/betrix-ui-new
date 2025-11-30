// StatPal removed from runtime — provide a lightweight stub so imports remain safe
import { Logger } from '../utils/logger.js';
const logger = new Logger('StatPalService');

class StatPalService {
  constructor(redis = null) {
    this.redis = redis;
    logger.info('StatPalService disabled: StatPal support removed from this deployment.');
  }

  async getLiveScores() { return null; }
  async getLiveOdds() { return null; }
  async getFixtures() { return null; }
  async getStandings() { return null; }
  async getPlayerStats() { return null; }
  async getTeamStats() { return null; }
  async getInjuries() { return null; }
  async getLivePlayByPlay() { return null; }
  async getLiveMatchStats() { return null; }
  async getResults() { return null; }
  async getScoringLeaders() { return null; }
  async getRosters() { return null; }
  async healthCheck() { return false; }
  static getAvailableSports() { return []; }
}

export default StatPalService;
