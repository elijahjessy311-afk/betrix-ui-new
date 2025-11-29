/**
 * Football Feed Aggregator
 * Unified live matches + fixtures from SportMonks + Football-Data.org
 * With Redis caching (30s live, 1h fixtures)
 */

import { Logger } from '../utils/logger.js';
import SportMonksService from './sportmonks-service.js';
import FootballDataService from './footballdata.js';

const logger = new Logger('FootballAggregator');

class FootballAggregator {
  constructor(redis) {
    this.redis = redis;
    this.sportMonks = new SportMonksService();
    this.footballData = new FootballDataService();
    this.LIVE_CACHE_TTL = 30; // 30 seconds
    this.FIXTURES_CACHE_TTL = 3600; // 1 hour
  }

  /**
   * Get live matches from SportMonks (cached 30s)
   */
  async getLiveMatches() {
    const cacheKey = 'football:live:all';

    try {
      // Check cache
      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          logger.debug('Live matches from cache');
          return JSON.parse(cached);
        }
      }

      // Fetch from SportMonks
      const matches = await this.sportMonks.getLivescores();
      if (!matches || matches.length === 0) {
        return [];
      }

      // Normalize to unified schema
      const normalized = matches.map(m => ({
        id: m.id || String(Math.random()),
        provider: 'SportMonks',
        home: m.home_team || m.home || 'Unknown',
        away: m.away_team || m.away || 'Unknown',
        homeScore: m.homeScore !== undefined ? m.homeScore : m.score?.home,
        awayScore: m.awayScore !== undefined ? m.awayScore : m.score?.away,
        status: m.status || 'LIVE',
        league: m.league || 'Unknown League',
        leagueId: m.league_id,
        venue: m.venue || 'Unknown Venue',
        venueId: m.venue_id,
        time: m.time || new Date().toISOString(),
        timestamp: m.timestamp || Date.now(),
        homeOdds: m.homeOdds || '1.95',
        drawOdds: m.drawOdds || '3.60',
        awayOdds: m.awayOdds || '4.10',
        hasOdds: !!m.homeOdds,
        round: m.round || 'Unknown',
        minute: m.minute,
        referee: m.referee,
        attendance: m.attendance
      }));

      // Cache for 30 seconds
      if (this.redis) {
        try {
          await this.redis.setex(cacheKey, this.LIVE_CACHE_TTL, JSON.stringify(normalized));
        } catch (e) {
          logger.warn('Redis cache set failed for live matches', e?.message);
        }
      }

      return normalized;
    } catch (e) {
      logger.warn('getLiveMatches error', e?.message);
      return [];
    }
  }

  /**
   * Get upcoming fixtures from Football-Data.org (cached 1h)
   */
  async getFixtures(dateFromStr = null, dateToStr = null) {
    const cacheKey = 'football:fixtures:upcoming';

    try {
      // Check cache
      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          logger.debug('Fixtures from cache');
          return JSON.parse(cached);
        }
      }

      // Calculate date range if not provided (today + next 7 days)
      const dateFrom = dateFromStr || new Date().toISOString().split('T')[0];
      const dateTo = dateToStr || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      // Fetch from Football-Data.org
      const fixtures = await this.footballData.getMatches({ dateFrom, dateTo });
      if (!fixtures || fixtures.length === 0) {
        return [];
      }

      // Normalize to unified schema
      const normalized = fixtures.map(f => ({
        id: f.id || String(Math.random()),
        provider: 'Football-Data.org',
        home: f.homeTeam?.name || f.home || 'Unknown',
        away: f.awayTeam?.name || f.away || 'Unknown',
        homeId: f.homeTeam?.id,
        awayId: f.awayTeam?.id,
        status: f.status || 'SCHEDULED',
        league: f.competition?.name || 'Unknown',
        leagueId: f.competition?.id,
        venue: f.venue || 'Unknown Venue',
        kickoff: f.utcDate || new Date().toISOString(),
        timestamp: f.utcDate ? new Date(f.utcDate).getTime() : Date.now(),
        round: f.season?.currentMatchday || f.week,
        group: f.group,
        attendance: f.attendance,
        referee: f.referees?.[0]?.name
      }));

      // Cache for 1 hour
      if (this.redis) {
        try {
          await this.redis.setex(cacheKey, this.FIXTURES_CACHE_TTL, JSON.stringify(normalized));
        } catch (e) {
          logger.warn('Redis cache set failed for fixtures', e?.message);
        }
      }

      return normalized;
    } catch (e) {
      logger.warn('getFixtures error', e?.message);
      return [];
    }
  }

  /**
   * Get detailed match analysis
   * Combines live data, fixtures data, head-to-head, form, odds
   */
  async getMatchAnalysis(matchId, isLive = true) {
    try {
      let match = null;

      if (isLive) {
        const live = await this.getLiveMatches();
        match = live.find(m => String(m.id) === String(matchId));
      } else {
        const fixtures = await this.getFixtures();
        match = fixtures.find(f => String(f.id) === String(matchId));
      }

      if (!match) {
        return null;
      }

      // Build analysis object
      const analysis = {
        ...match,
        h2h: await this.getHeadToHead(match.homeId || match.id, match.awayId || match.id),
        stats: {
          home: await this.getTeamStats(match.homeId || match.id),
          away: await this.getTeamStats(match.awayId || match.id)
        }
      };

      return analysis;
    } catch (e) {
      logger.warn('getMatchAnalysis error', e?.message);
      return null;
    }
  }

  /**
   * Get head-to-head history (stub - can integrate with API)
   */
  async getHeadToHead(homeId, awayId) {
    return {
      totalMatches: 'N/A',
      homeWins: 'N/A',
      awayWins: 'N/A',
      draws: 'N/A'
    };
  }

  /**
   * Get team stats (stub - can integrate with API)
   */
  async getTeamStats(teamId) {
    return {
      position: 'N/A',
      played: 'N/A',
      won: 'N/A',
      drawn: 'N/A',
      lost: 'N/A',
      goalsFor: 'N/A',
      goalsAgainst: 'N/A',
      goalDiff: 'N/A',
      points: 'N/A'
    };
  }

  /**
   * Format live match for display
   */
  formatLiveMatch(match) {
    const score = match.homeScore !== undefined ? `${match.homeScore}-${match.awayScore}` : 'TBA';
    return `⚽ *${match.home}* ${score} *${match.away}*\n⏱ ${match.status} | 🏟 ${match.league}`;
  }

  /**
   * Format fixture for display
   */
  formatFixture(fixture) {
    const kickoffDate = new Date(fixture.kickoff);
    const timeStr = kickoffDate.toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    return `📅 *${fixture.home}* vs *${fixture.away}*\n⏰ ${timeStr} UTC | 🏟 ${fixture.league}`;
  }

  /**
   * Format match analysis for display
   */
  formatAnalysis(analysis) {
    let text = `*Match Analysis*\n\n`;
    text += `*${analysis.home}* vs *${analysis.away}*\n`;
    text += `🏟 ${analysis.league}\n`;
    text += `📍 ${analysis.venue}\n`;
    text += `⏱ Status: ${analysis.status}\n\n`;

    if (analysis.status === 'LIVE') {
      text += `*Score:* ${analysis.homeScore}-${analysis.awayScore}\n`;
      if (analysis.minute) text += `*Minute:* ${analysis.minute}\n`;
    } else {
      text += `*Kickoff:* ${new Date(analysis.kickoff).toUTCString()}\n`;
    }

    if (analysis.hasOdds || analysis.homeOdds) {
      text += `\n💰 *Odds:*\n`;
      text += `${analysis.home}: ${analysis.homeOdds} | Draw: ${analysis.drawOdds} | ${analysis.away}: ${analysis.awayOdds}\n`;
    }

    text += `\n*Team Stats:*\n`;
    text += `${analysis.home}: Pos ${analysis.stats?.home?.position || 'N/A'} | ${analysis.stats?.home?.points || 0} pts\n`;
    text += `${analysis.away}: Pos ${analysis.stats?.away?.position || 'N/A'} | ${analysis.stats?.away?.points || 0} pts\n`;

    text += `\n_Provider: ${analysis.provider}_`;

    return text;
  }
}

export default FootballAggregator;
