/**
 * Data Exposure API Handler
 * Provides RESTful endpoints to access all cached sports data
 * Enables debugging, monitoring, and external integrations
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('DataExposure');

export class DataExposureHandler {
  constructor(router, sportsAggregator) {
    this.router = router;
    this.aggregator = sportsAggregator;
    this.registerRoutes();
  }

  registerRoutes() {
    /**
     * GET /api/data/summary
     * Returns overview of all cached data
     */
    this.router.get('/api/data/summary', async (req, res) => {
      try {
        const summary = await this.aggregator.dataCache.getDataSummary();
        res.json(summary);
      } catch (e) {
        logger.error('Summary failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/live?source=sportsmonks|footballdata
     * Returns all live matches from specified source
     */
    this.router.get('/api/data/live', async (req, res) => {
      try {
        const { source = 'sportsmonks' } = req.query;
        const matches = await this.aggregator.dataCache.getLiveMatches(source);
        res.json({
          source,
          count: matches.length,
          matches
        });
      } catch (e) {
        logger.error('Live matches endpoint failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/fixtures?source=sportsmonks|footballdata&league=39
     * Returns all fixtures from specified league and source
     */
    this.router.get('/api/data/fixtures', async (req, res) => {
      try {
        const { source = 'sportsmonks', league = '39' } = req.query;
        const fixtures = await this.aggregator.dataCache.getFixtures(source, league);
        res.json({
          source,
          league,
          count: fixtures.length,
          fixtures
        });
      } catch (e) {
        logger.error('Fixtures endpoint failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/match/:matchId?source=sportsmonks|footballdata
     * Returns full match details with all available fields
     */
    this.router.get('/api/data/match/:matchId', async (req, res) => {
      try {
        const { matchId } = req.params;
        const { source } = req.query;

        if (source) {
          // Get from specific source
          const match = await this.aggregator.dataCache.getMatchDetail(matchId, source);
          res.json({ matchId, source, match });
        } else {
          // Get from all sources
          const match = await this.aggregator.dataCache.getFullMatchData(matchId);
          res.json(match);
        }
      } catch (e) {
        logger.error('Match detail endpoint failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/standings/:leagueId?source=sportsmonks|footballdata
     * Returns league standings with all teams and statistics
     */
    this.router.get('/api/data/standings/:leagueId', async (req, res) => {
      try {
        const { leagueId } = req.params;
        const { source = 'sportsmonks' } = req.query;

        const standings = await this.aggregator.dataCache.getStandings(leagueId, source);
        res.json({
          leagueId,
          source,
          standings
        });
      } catch (e) {
        logger.error('Standings endpoint failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/leagues?source=sportsmonks|footballdata
     * Returns all available leagues
     */
    this.router.get('/api/data/leagues', async (req, res) => {
      try {
        const { source = 'sportsmonks' } = req.query;
        const leagues = await this.aggregator.dataCache.getLeagues(source);
        res.json({
          source,
          count: leagues.length,
          leagues
        });
      } catch (e) {
        logger.error('Leagues endpoint failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/cache-info
     * Returns detailed cache status and memory usage
     */
    this.router.get('/api/data/cache-info', async (req, res) => {
      try {
        const exportedData = await this.aggregator.dataCache.exportAll();
        const totalSize = exportedData.entries.reduce((sum, e) => sum + e.size, 0);

        res.json({
          ...exportedData,
          totalSize,
          totalEntries: exportedData.entries.length,
          estimatedSizeKb: (totalSize / 1024).toFixed(2)
        });
      } catch (e) {
        logger.error('Cache info endpoint failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * POST /api/data/cache-cleanup
     * Manually trigger cache cleanup (removes expired entries)
     */
    this.router.post('/api/data/cache-cleanup', async (req, res) => {
      try {
        const cleaned = await this.aggregator.dataCache.cleanup();
        res.json({
          success: true,
          cleaned,
          message: `Removed ${cleaned} expired cache entries`
        });
      } catch (e) {
        logger.error('Cache cleanup failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/export
     * Export all cached data as JSON
     */
    this.router.get('/api/data/export', async (req, res) => {
      try {
        const summary = await this.aggregator.dataCache.getDataSummary();
        const smLive = await this.aggregator.dataCache.getLiveMatches('sportsmonks');
        const fdLive = await this.aggregator.dataCache.getLiveMatches('footballdata');
        const smLeagues = await this.aggregator.dataCache.getLeagues('sportsmonks');

        const exported = {
          exportedAt: new Date().toISOString(),
          summary,
          data: {
            sportsmonks: {
              live: smLive,
              leagues: smLeagues
            },
            footballdata: {
              live: fdLive
            }
          }
        };

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="sports-data-${Date.now()}.json"`);
        res.json(exported);
      } catch (e) {
        logger.error('Export failed:', e);
        res.status(500).json({ error: e.message });
      }
    });

    /**
     * GET /api/data/schema
     * Returns the API schema/documentation
     */
    this.router.get('/api/data/schema', (req, res) => {
      const schema = {
        version: '1.0',
        description: 'Sports Data Exposure API - Access all cached sports data',
        endpoints: {
          'GET /api/data/summary': {
            description: 'Overview of all cached data',
            response: { summary: 'object' }
          },
          'GET /api/data/live': {
            description: 'All live matches from source',
            query: { source: 'string (sportsmonks|footballdata)' },
            response: { source: 'string', count: 'number', matches: 'array' }
          },
          'GET /api/data/fixtures': {
            description: 'All fixtures from league',
            query: { source: 'string', league: 'string' },
            response: { source: 'string', league: 'string', count: 'number', fixtures: 'array' }
          },
          'GET /api/data/match/:matchId': {
            description: 'Full match details with all fields',
            params: { matchId: 'string|number' },
            query: { source: 'string (optional)' },
            response: { matchId: 'string', source: 'string', match: 'object' }
          },
          'GET /api/data/standings/:leagueId': {
            description: 'League standings and statistics',
            params: { leagueId: 'string|number' },
            query: { source: 'string' },
            response: { leagueId: 'string', source: 'string', standings: 'object' }
          },
          'GET /api/data/leagues': {
            description: 'All available leagues',
            query: { source: 'string' },
            response: { source: 'string', count: 'number', leagues: 'array' }
          },
          'GET /api/data/cache-info': {
            description: 'Cache status and memory usage',
            response: { totalSize: 'number', totalEntries: 'number', estimatedSizeKb: 'string' }
          },
          'POST /api/data/cache-cleanup': {
            description: 'Manually cleanup expired cache entries',
            response: { success: 'boolean', cleaned: 'number', message: 'string' }
          },
          'GET /api/data/export': {
            description: 'Export all cached data as JSON file',
            response: { exportedAt: 'ISO string', summary: 'object', data: 'object' }
          }
        },
        sources: ['sportsmonks', 'footballdata'],
        majorLeagues: {
          '39': 'Premier League',
          '140': 'La Liga',
          '135': 'Serie A',
          '61': 'Ligue 1',
          '78': 'Bundesliga',
          '2': 'Champions League'
        }
      };

      res.json(schema);
    });

    logger.info('✅ Data exposure endpoints registered');
  }
}

export default DataExposureHandler;
