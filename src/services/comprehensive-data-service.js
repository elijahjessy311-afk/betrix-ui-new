/**
 * Comprehensive Data Service
 * Preserves all raw API data while providing multiple formatted views
 * Ensures nothing is lost from SportMonks and Football-Data APIs
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('ComprehensiveDataService');

export class ComprehensiveDataService {
  constructor(sportsAggregator, redis = null) {
    this.aggregator = sportsAggregator;
    this.redis = redis;
    this.cache = new Map();
  }

  /**
   * Get all live data with COMPLETE information from SportMonks
   * Preserves every field the API returns
   */
  async getSportMonksLiveComplete() {
    const cacheKey = 'sportmonks:live:complete';
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30 * 1000) { // 30 sec cache
        return cached.data;
      }
    }

    try {
      logger.info('📡 Fetching COMPLETE SportMonks live data');
      
      // Call the service directly to get raw data
      const rawData = await this.aggregator.sportmonks?.getAllLiveMatches();
      
      if (!rawData || rawData.length === 0) {
        logger.warn('No SportMonks live data available');
        return [];
      }

      // Preserve ALL fields while adding computed properties
      const enhanced = rawData.map(match => ({
        // ===== SPORTMONKS NATIVE FIELDS (ALL PRESERVED) =====
        ...match,
        
        // ===== COMPUTED ENRICHED FIELDS =====
        _enriched: {
          // Status interpretation
          statusLabel: this._interpretSportMonksState(match.state_id),
          stateId: match.state_id,
          
          // Time display
          timeDisplay: this._formatSportMonksTime(match),
          
          // Odds available flags
          hasOdds: match.has_odds === true,
          hasPremiumOdds: match.has_premium_odds === true,
          
          // League info
          leagueId: match.league_id,
          seasonId: match.season_id,
          
          // Match structure
          isLeg: (match.leg && match.leg !== '1/1'),
          legInfo: match.leg,
          
          // Score info (if available in result_info)
          scoreInfo: match.result_info,
          
          // Fixture details
          matchName: match.name,
          length: match.length, // Match duration
          placeholder: match.placeholder,
          
          // Timestamps
          scheduledFor: new Date(match.starting_at * 1000),
          timestamp: match.starting_at_timestamp,
          
          // Venue
          venueId: match.venue_id,
        },
        
        // Timestamp for cache management
        fetchedAt: new Date().toISOString(),
        provider: 'sportmonks'
      }));

      this.cache.set(cacheKey, {
        data: enhanced,
        timestamp: Date.now()
      });

      logger.info(`✅ Fetched ${enhanced.length} complete SportMonks matches`);
      return enhanced;
    } catch (e) {
      logger.error('Error fetching complete SportMonks data:', e.message);
      return [];
    }
  }

  /**
   * Get all Football-Data matches with COMPLETE information
   * Preserves every field the API returns
   */
  async getFootballDataComplete() {
    const cacheKey = 'footballdata:matches:complete';
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30 * 1000) { // 30 sec cache
        return cached.data;
      }
    }

    try {
      logger.info('📡 Fetching COMPLETE Football-Data matches');
      
      // Get raw data from aggregator's internal method
      const url = `${this.aggregator.CONFIG?.FOOTBALLDATA?.BASE || 'https://api.football-data.org/v4'}/matches`;
      const response = await this.aggregator._fetchWithRetry(url, {
        headers: { 'X-Auth-Token': this.aggregator.CONFIG?.FOOTBALLDATA?.KEY }
      }, 2);

      if (!response || !response.matches) {
        logger.warn('No Football-Data matches available');
        return [];
      }

      // Preserve ALL fields while adding computed properties
      const enhanced = (response.matches || []).map(match => ({
        // ===== FOOTBALL-DATA NATIVE FIELDS (ALL PRESERVED) =====
        ...match,
        
        // ===== COMPUTED ENRICHED FIELDS =====
        _enriched: {
          // Status interpretation
          statusLabel: match.status,
          
          // Time display
          timeDisplay: this._formatFootballDataTime(match),
          
          // Scores
          homeScore: match.score?.fullTime?.home ?? null,
          awayScore: match.score?.fullTime?.away ?? null,
          halftimeHome: match.score?.halfTime?.home ?? null,
          halftimeAway: match.score?.halfTime?.away ?? null,
          
          // Teams
          homeTeam: match.homeTeam?.name,
          awayTeam: match.awayTeam?.name,
          homeTeamId: match.homeTeam?.id,
          awayTeamId: match.awayTeam?.id,
          
          // Competition
          competitionName: match.competition?.name,
          competitionCode: match.competition?.code,
          competitionId: match.competition?.id,
          
          // Season
          seasonStart: match.season?.startDate,
          seasonEnd: match.season?.endDate,
          
          // Match details
          matchday: match.matchday,
          stage: match.stage,
          group: match.group,
          
          // Area (country)
          areaName: match.area?.name,
          areaCode: match.area?.code,
          
          // Venue
          venue: match.venue,
          referee: match.referee?.name,
          
          // Timestamps
          kickoffTime: new Date(match.utcDate),
          utcDate: match.utcDate,
        },
        
        // Timestamp for cache management
        fetchedAt: new Date().toISOString(),
        provider: 'footballdata'
      }));

      this.cache.set(cacheKey, {
        data: enhanced,
        timestamp: Date.now()
      });

      logger.info(`✅ Fetched ${enhanced.length} complete Football-Data matches`);
      return enhanced;
    } catch (e) {
      logger.error('Error fetching complete Football-Data data:', e.message);
      return [];
    }
  }

  /**
   * Get unified live data from both providers with complete information
   */
  async getUnifiedLiveData() {
    try {
      logger.info('📡 Fetching unified complete live data from both providers');
      
      const [smLive, fdMatches] = await Promise.all([
        this.getSportMonksLiveComplete(),
        this.getFootballDataComplete()
      ]);

      return {
        sportmonks: {
          count: smLive.length,
          live: (smLive || []).filter(m => m._enriched?.statusLabel === 'LIVE'),
          scheduled: (smLive || []).filter(m => m._enriched?.statusLabel === 'SCHEDULED'),
          finished: (smLive || []).filter(m => m._enriched?.statusLabel === 'FINISHED'),
          all: smLive
        },
        footballdata: {
          count: fdMatches.length,
          live: (fdMatches || []).filter(m => m.status === 'LIVE'),
          scheduled: (fdMatches || []).filter(m => m.status === 'SCHEDULED'),
          finished: (fdMatches || []).filter(m => m.status === 'FINISHED'),
          all: fdMatches
        },
        summary: {
          totalLive: smLive.filter(m => m._enriched?.statusLabel === 'LIVE').length + 
                     fdMatches.filter(m => m.status === 'LIVE').length,
          totalScheduled: smLive.filter(m => m._enriched?.statusLabel === 'SCHEDULED').length + 
                          fdMatches.filter(m => m.status === 'SCHEDULED').length,
          totalFinished: smLive.filter(m => m._enriched?.statusLabel === 'FINISHED').length + 
                         fdMatches.filter(m => m.status === 'FINISHED').length
        },
        fetchedAt: new Date().toISOString()
      };
    } catch (e) {
      logger.error('Error fetching unified live data:', e.message);
      return { sportmonks: { all: [] }, footballdata: { all: [] }, summary: {} };
    }
  }

  /**
   * Get detailed information about a specific match
   * Returns complete raw data plus enriched analysis
   */
  async getMatchComplete(matchId, provider = 'auto') {
    try {
      logger.info(`📋 Fetching complete data for match ${matchId}`);
      
      let match = null;

      if (provider === 'sportmonks' || provider === 'auto') {
        const smData = await this.getSportMonksLiveComplete();
        match = smData.find(m => String(m.id) === String(matchId));
      }

      if (!match && (provider === 'footballdata' || provider === 'auto')) {
        const fdData = await this.getFootballDataComplete();
        match = fdData.find(m => String(m.id) === String(matchId));
      }

      if (!match) {
        logger.warn(`Match ${matchId} not found`);
        return null;
      }

      // Add analysis
      match._analysis = this._analyzeMatch(match);
      
      return match;
    } catch (e) {
      logger.error('Error fetching match details:', e.message);
      return null;
    }
  }

  /**
   * Get raw JSON export of all live data
   */
  async exportAllRawJSON() {
    try {
      const [smLive, fdMatches] = await Promise.all([
        this.getSportMonksLiveComplete(),
        this.getFootballDataComplete()
      ]);

      return {
        exportDate: new Date().toISOString(),
        sportmonks: smLive,
        footballdata: fdMatches,
        stats: {
          sportmonks_count: smLive.length,
          footballdata_count: fdMatches.length,
          total: smLive.length + fdMatches.length
        }
      };
    } catch (e) {
      logger.error('Error exporting data:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Helper: Interpret SportMonks state_id
   */
  _interpretSportMonksState(stateId) {
    const states = {
      1: 'NOT_STARTED',
      2: 'IN_PROGRESS',
      3: 'FINISHED',
      4: 'FINISHED', // postponed finish
      5: 'POSTPONED',
      6: 'CANCELLED',
      7: 'ABANDONED',
      8: 'LIVE', // custom live state
      22: 'LIVE' // another live variant
    };
    return states[stateId] || `STATE_${stateId}`;
  }

  /**
   * Helper: Format SportMonks time
   */
  _formatSportMonksTime(match) {
    if (!match.starting_at_timestamp) return 'TBA';
    
    const date = new Date(match.starting_at_timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Helper: Format Football-Data time
   */
  _formatFootballDataTime(match) {
    if (!match.utcDate) return 'TBA';
    
    const date = new Date(match.utcDate);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Helper: Analyze match for insights
   */
  _analyzeMatch(match) {
    const analysis = {
      isLive: (match._enriched?.statusLabel || match.status) === 'LIVE',
      hasOdds: match._enriched?.hasOdds ?? false,
      hasPremiumOdds: match._enriched?.hasPremiumOdds ?? false,
      hasScore: (match._enriched?.homeScore !== null && match._enriched?.awayScore !== null) ||
                (match.score?.fullTime?.home !== null && match.score?.fullTime?.away !== null),
      venue: match._enriched?.venueId ?? match.venue ?? 'Unknown',
      competition: match._enriched?.competitionCode ?? match._enriched?.leagueId ?? 'Unknown'
    };
    
    return analysis;
  }
}

export default ComprehensiveDataService;
