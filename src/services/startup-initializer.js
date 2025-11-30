/**
 * Startup Initializer for Betrix Bot
 * StatPal removed — startup prefetch via StatPal is disabled.
 * Prefetch scheduler (every 60s) will handle data from SportMonks and Football-Data.
 */

import { CONFIG } from '../config.js';
import { Logger } from '../utils/logger.js';
const logger = new Logger('StartupInitializer');

class StartupInitializer {
  constructor(redis = null) {
    this.redis = redis;
    this.initialized = false;
    this.lastInitTime = null;
    this.sportData = {};
  }

  /**
   * Initialize bot (no StatPal startup prefetch)
   */
  async initialize() {
    if (this.initialized) return this.sportData;

    logger.info('🤖 [Startup] StatPal support removed; startup prefetch disabled. Prefetch scheduler will populate SportMonks/Football-Data caches.');

    this.initialized = true;
    this.lastInitTime = Date.now();
    return {};
  }

  getSpportData(sport) {
    return this.sportData[sport] || null;
  }

  getAllData() {
    return this.sportData;
  }

  isReady() {
    return this.initialized && Object.keys(this.sportData).length > 0;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      ready: this.isReady(),
      sports: Object.keys(this.sportData),
      totalItems: Object.values(this.sportData).flat().length,
      timestamp: this.lastInitTime,
      uptime: this.lastInitTime ? Date.now() - this.lastInitTime : 0,
    };
  }
}

export default StartupInitializer;
