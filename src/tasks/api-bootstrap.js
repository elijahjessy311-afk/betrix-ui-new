/**
 * API Bootstrap & Initialization
 * Validates all configured API keys on startup and immediately begins prefetching
 * live matches, upcoming fixtures, and odds from all available providers
 */

import { CONFIG } from '../config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('APIBootstrap');

export class APIBootstrap {
  constructor(sportsAggregator, oddsAnalyzer, redis) {
    this.sportsAggregator = sportsAggregator;
    this.oddsAnalyzer = oddsAnalyzer;
    this.redis = redis;
    this.providers = {};
    this.isInitialized = false;
  }

  /**
   * Validate all configured API keys and report status
   */
  validateAPIKeys() {
    const status = {
      timestamp: new Date().toISOString(),
      providers: {}
    };

    logger.info('🚀 Initializing with SportMonks and Football-Data only');

    // Check Football-Data.org
    if (CONFIG.FOOTBALLDATA && CONFIG.FOOTBALLDATA.KEY) {
      status.providers.FOOTBALLDATA = {
        enabled: true,
        key: `${CONFIG.FOOTBALLDATA.KEY.substring(0, 8)}...${CONFIG.FOOTBALLDATA.KEY.substring(CONFIG.FOOTBALLDATA.KEY.length - 4)}`,
        base: CONFIG.FOOTBALLDATA.BASE || 'https://api.football-data.org/v4'
      };
      this.providers.footballData = true;
      logger.info('✅ Football-Data.org configured', status.providers.FOOTBALLDATA);
    } else {
      status.providers.FOOTBALLDATA = { enabled: false, reason: 'FOOTBALLDATA_API_KEY not set' };
      logger.warn('⚠️  Football-Data.org NOT configured');
    }

    // Check SportMonks
    if (CONFIG.SPORTSMONKS && CONFIG.SPORTSMONKS.KEY) {
      status.providers.SPORTSMONKS = {
        enabled: true,
        key: `${CONFIG.SPORTSMONKS.KEY.substring(0, 8)}...${CONFIG.SPORTSMONKS.KEY.substring(CONFIG.SPORTSMONKS.KEY.length - 4)}`,
        base: CONFIG.SPORTSMONKS.BASE || 'https://api.sportsmonks.com/v3'
      };
      this.providers.sportMonks = true;
      logger.info('✅ SportMonks configured', status.providers.SPORTSMONKS);
    } else {
      status.providers.SPORTSMONKS = { enabled: false, reason: 'SPORTSMONKS_API_KEY not set' };
      logger.warn('⚠️  SportMonks NOT configured');
    }

    // Summary
    const enabledCount = Object.values(this.providers).filter(Boolean).length;
    status.summary = {
      enabledProviders: enabledCount,
      totalChecked: Object.keys(status.providers).length,
      readyForLiveData: enabledCount > 0
    };

    logger.info('📊 API Provider Status', status);
    
    // Store in Redis for monitoring
    try {
      this.redis.set('betrix:api:bootstrap:status', JSON.stringify(status), 'EX', 3600);
    } catch (e) {
      logger.warn('Failed to store bootstrap status in Redis', e?.message);
    }

    return status;
  }

  /**
   * Immediately prefetch live matches from SportMonks and Football-Data
   */
  async prefetchLiveMatches() {
    logger.info('🔄 Prefetching live matches from SportMonks/Football-Data...');
    
    const results = {
      timestamp: new Date().toISOString(),
      totalMatches: 0
    };

    try {
      const matches = await this.sportsAggregator.getLiveMatches('football');
      if (matches && Array.isArray(matches) && matches.length > 0) {
        results.totalMatches = matches.length;
        logger.info(`✅ Found ${matches.length} live matches from SportMonks/Football-Data`);
      } else {
        logger.info('ℹ️  No live matches available at this time');
      }
    } catch (e) {
      logger.warn('⚠️  Failed to prefetch live matches', e?.message);
      results.error = e.message;
    }

    return results;
  }

  /**
   * Immediately prefetch upcoming fixtures from SportMonks and Football-Data
   */
  async prefetchUpcomingFixtures() {
    logger.info('🔄 Prefetching upcoming fixtures from SportMonks/Football-Data...');
    
    const results = {
      timestamp: new Date().toISOString(),
      totalFixtures: 0
    };

    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const fixtures = await this.sportsAggregator.getFixtures(today, tomorrow);
      
      if (fixtures && Array.isArray(fixtures) && fixtures.length > 0) {
        results.totalFixtures = fixtures.length;
        logger.info(`✅ Found ${fixtures.length} upcoming fixtures from SportMonks/Football-Data`);
      } else {
        logger.info('ℹ️  No upcoming fixtures available');
      }
    } catch (e) {
      logger.warn('⚠️  Failed to prefetch upcoming fixtures', e?.message);
      results.error = e.message;
    }

    return results;
  }

  /**
   * Immediately prefetch odds from SportMonks and Football-Data
   */
  async prefetchOdds() {
    logger.info('🔄 Prefetching odds from SportMonks/Football-Data...');
    
    const results = {
      timestamp: new Date().toISOString(),
      totalOdds: 0
    };

    try {
      const odds = await this.sportsAggregator.getOdds('football');
      
      if (odds && Array.isArray(odds) && odds.length > 0) {
        results.totalOdds = odds.length;
        logger.info(`✅ Found ${odds.length} odds entries from SportMonks/Football-Data`);
      } else {
        logger.info('ℹ️  No odds available');
      }
    } catch (e) {
      logger.warn('⚠️  Failed to prefetch odds', e?.message);
      results.error = e.message;
    }

    return results;
  }

  /**
   * Full initialization: validate keys, then start prefetching
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('API Bootstrap already initialized, skipping');
      return;
    }

    try {
      logger.info('🚀 Starting API Bootstrap...');
      
      // Step 1: Validate all keys
      const keyStatus = this.validateAPIKeys();
      
      logger.info(`✅ Bootstrap found configured providers`);

      // Step 2: Immediately prefetch data
      logger.info('⏱️  Starting immediate data prefetch (this may take 10-30 seconds)...');

      const liveMatches = await this.prefetchLiveMatches();
      const upcomingFixtures = await this.prefetchUpcomingFixtures();
      const odds = await this.prefetchOdds();

      logger.info('✅ API Bootstrap Complete!', {
        liveMatches: liveMatches.totalMatches || 0,
        upcomingFixtures: upcomingFixtures.totalFixtures || 0,
        oddsAvailable: odds.totalOdds || 0
      });

      this.isInitialized = true;
      return {
        success: true,
        providers: keyStatus,
        data: {
          liveMatches: liveMatches.totalMatches || 0,
          upcomingFixtures: upcomingFixtures.totalFixtures || 0,
          oddsAvailable: odds.totalOdds || 0
        }
      };

    } catch (e) {
      logger.error('❌ API Bootstrap failed', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Start continuous prefetch cycle (called after successful initialization)
   */
  startContinuousPrefetch(intervalSeconds = 60) {
    logger.info(`🔁 Starting continuous prefetch cycle (every ${intervalSeconds}s)`);

    setInterval(async () => {
      try {
        const liveMatches = await this.prefetchLiveMatches();
        const upcomingFixtures = await this.prefetchUpcomingFixtures();
        
        if ((liveMatches.totalMatches || 0) > 0 || (upcomingFixtures.totalFixtures || 0) > 0) {
          logger.info(`🔄 Prefetch cycle: ${liveMatches.totalMatches || 0} live, ${upcomingFixtures.totalFixtures || 0} upcoming`);
        }
      } catch (e) {
        logger.warn('Continuous prefetch cycle failed', e?.message);
      }
    }, intervalSeconds * 1000);

    logger.info('✅ Continuous prefetch cycle started');
  }
}

export default APIBootstrap;
