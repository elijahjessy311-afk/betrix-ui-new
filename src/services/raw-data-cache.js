/**
 * Raw Data Caching Service
 * Preserves and exposes all data from SportMonks and Football-Data APIs
 * Provides comprehensive access to raw API responses with full detail
 */

import { Logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

const logger = new Logger('RawDataCache');

export class RawDataCache {
  constructor(redis = null) {
    this.redis = redis;
    this.memCache = new Map(); // In-memory fallback
    this.ttl = {
      live: 2 * 60, // 2 minutes for live data
      fixtures: 10 * 60, // 10 minutes for fixtures
      standings: 30 * 60, // 30 minutes for standings
      leagues: 24 * 60 * 60 // 24 hours for leagues
    };
  }

  /**
   * Store raw API response with metadata
   */
  async store(key, data, ttl = null) {
    const ttlSeconds = ttl || this.ttl.fixtures;
    const payload = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
      expires: Date.now() + (ttlSeconds * 1000)
    };

    const serialized = JSON.stringify(payload);

    // Store in Redis if available
    if (this.redis) {
      try {
        await this.redis.setex(key, ttlSeconds, serialized);
      } catch (e) {
        logger.warn(`Redis store failed for ${key}:`, e.message);
        this.memCache.set(key, payload);
      }
    } else {
      this.memCache.set(key, payload);
    }

    return payload;
  }

  /**
   * Retrieve raw data with expiration check
   */
  async get(key) {
    try {
      // Try Redis first
      if (this.redis) {
        const raw = await this.redis.get(key).catch(() => null);
        if (raw) {
          const payload = JSON.parse(raw);
          if (payload && payload.expires > Date.now()) {
            return payload;
          }
        }
      }

      // Fallback to memory cache
      const cached = this.memCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached;
      }

      // Clean up expired entry
      this.memCache.delete(key);
      return null;
    } catch (e) {
      logger.warn(`Get data failed for ${key}:`, e.message);
      return null;
    }
  }

  /**
   * Store all live matches from SportMonks
   */
  async storeLiveMatches(source, matches) {
    const key = `raw:live:${source}`;
    await this.store(key, matches, this.ttl.live);
    logger.info(`✅ Cached ${matches.length} live matches from ${source}`);
  }

  /**
   * Retrieve all live matches with full detail
   */
  async getLiveMatches(source) {
    const key = `raw:live:${source}`;
    const cached = await this.get(key);
    return cached ? cached.data : [];
  }

  /**
   * Store upcoming fixtures from provider
   */
  async storeFixtures(source, leagueId, fixtures) {
    const key = `raw:fixtures:${source}:${leagueId}`;
    await this.store(key, fixtures, this.ttl.fixtures);
    logger.info(`✅ Cached ${fixtures.length} fixtures from ${source} (league ${leagueId})`);
  }

  /**
   * Retrieve fixtures with full detail
   */
  async getFixtures(source, leagueId) {
    const key = `raw:fixtures:${source}:${leagueId}`;
    const cached = await this.get(key);
    return cached ? cached.data : [];
  }

  /**
   * Store match details
   */
  async storeMatch(matchId, source, matchData) {
    const key = `raw:match:${matchId}:${source}`;
    await this.store(key, matchData, this.ttl.live);
    return matchData;
  }

  /**
   * Get comprehensive match detail with all available fields
   */
  async getMatchDetail(matchId, source) {
    const key = `raw:match:${matchId}:${source}`;
    const cached = await this.get(key);
    return cached ? cached.data : null;
  }

  /**
   * Store standings table
   */
  async storeStandings(leagueId, source, standings) {
    const key = `raw:standings:${leagueId}:${source}`;
    await this.store(key, standings, this.ttl.standings);
    logger.info(`✅ Cached standings for league ${leagueId} from ${source}`);
  }

  /**
   * Get standings with all available fields
   */
  async getStandings(leagueId, source) {
    const key = `raw:standings:${leagueId}:${source}`;
    const cached = await this.get(key);
    return cached ? cached.data : null;
  }

  /**
   * Store league data
   */
  async storeLeagues(source, leagues) {
    const key = `raw:leagues:${source}`;
    await this.store(key, leagues, this.ttl.leagues);
    logger.info(`✅ Cached ${leagues.length} leagues from ${source}`);
  }

  /**
   * Get all leagues with full detail
   */
  async getLeagues(source) {
    const key = `raw:leagues:${source}`;
    const cached = await this.get(key);
    return cached ? cached.data : [];
  }

  /**
   * Get all available data for a specific match with maximum detail
   */
  async getFullMatchData(matchId) {
    const sources = ['sportsmonks', 'footballdata'];
    const data = {
      id: matchId,
      sportsmonks: await this.getMatchDetail(matchId, 'sportsmonks'),
      footballdata: await this.getMatchDetail(matchId, 'footballdata'),
      retrieved: new Date().toISOString()
    };

    // Filter out nulls
    Object.keys(data).forEach(k => !data[k] && delete data[k]);
    return data;
  }

  /**
   * Generate comprehensive data summary
   */
  async getDataSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      sources: {
        sportsmonks: {
          liveMatches: 0,
          fixtures: {},
          standings: {},
          leagues: 0
        },
        footballdata: {
          liveMatches: 0,
          fixtures: {},
          standings: {},
          leagues: 0
        }
      }
    };

    // Count live matches
    const smLive = await this.getLiveMatches('sportsmonks');
    const fdLive = await this.getLiveMatches('footballdata');
    summary.sources.sportsmonks.liveMatches = (smLive || []).length;
    summary.sources.footballdata.liveMatches = (fdLive || []).length;

    // Count leagues
    const smLeagues = await this.getLeagues('sportsmonks');
    const fdLeagues = await this.getLeagues('footballdata');
    summary.sources.sportsmonks.leagues = (smLeagues || []).length;
    summary.sources.footballdata.leagues = (fdLeagues || []).length;

    return summary;
  }

  /**
   * Clear expired data from cache
   */
  async cleanup() {
    try {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, value] of this.memCache.entries()) {
        if (value.expires < now) {
          this.memCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`🧹 Cleaned up ${cleaned} expired cache entries`);
      }

      return cleaned;
    } catch (e) {
      logger.warn('Cleanup failed:', e.message);
      return 0;
    }
  }

  /**
   * Export all cached data (for debugging/analysis)
   */
  async exportAll() {
    const exported = {
      timestamp: new Date().toISOString(),
      source: 'memory',
      entries: []
    };

    for (const [key, value] of this.memCache.entries()) {
      if (value.expires > Date.now()) {
        exported.entries.push({
          key,
          size: JSON.stringify(value.data).length,
          expiresIn: Math.round((value.expires - Date.now()) / 1000),
          dataType: Array.isArray(value.data) ? `Array[${value.data.length}]` : typeof value.data
        });
      }
    }

    return exported;
  }
}

export default RawDataCache;
