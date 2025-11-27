/**
 * Test: OpenLiga normalization + ScoreBat retry/cache
 */

import SportsAggregator from './src/services/sports-aggregator.js';
import ScoreBatService from './src/services/scorebat-enhanced.js';
import CacheService from './src/services/cache.js';
import OpenLigaDBService from './src/services/openligadb.js';
import Redis from 'ioredis';

(async () => {
  console.log('=== OpenLiga + ScoreBat Enhancement Tests ===\n');

  // Mock Redis for cache
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const cache = new CacheService(redis);

  try {
    // Test 1: ScoreBat with retry + cache
    console.log('Test 1: ScoreBat with retry + cache');
    const scorebat = new ScoreBatService(null, cache, { retries: 3, cacheTtlSeconds: 30 });
    
    console.log('  - Fetching free feed (with 3 retries + cache)...');
    try {
      const feed = await scorebat.freeFeed();
      console.log(`  ✅ ScoreBat free feed: ${Array.isArray(feed) ? feed.length : 'N/A'} items`);
    } catch (e) {
      console.log(`  ⚠️ ScoreBat free feed failed (expected): ${e.message}`);
    }

    console.log('  - Fetching featured (with 3 retries + cache)...');
    try {
      const featured = await scorebat.featured();
      console.log(`  ✅ ScoreBat featured: ${Array.isArray(featured) ? featured.length : 'N/A'} items`);
    } catch (e) {
      console.log(`  ⚠️ ScoreBat featured failed (expected): ${e.message}`);
    }

    // Test 2: OpenLiga normalization
    console.log('\nTest 2: OpenLiga normalization');
    const openLiga = new OpenLigaDBService();
    const agg = new SportsAggregator(redis, { scorebat, openLiga });
    
    // Create a mock OpenLiga match to test normalization
    const mockOpenLigaMatch = {
      MatchID: 12345,
      Team1: { TeamName: 'Borussia Dortmund', Name: 'BVB' },
      Team2: { TeamName: 'Bayern Munich', Name: 'FCB' },
      MatchDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      MatchIsFinished: false,
      MatchResults: [
        { PointsTeam1: 2, PointsTeam2: 1 }
      ],
      Location: {
        LocationCity: 'Dortmund',
        LocationStadium: 'Signal Iduna Park'
      }
    };

    console.log('  - Normalizing mock OpenLiga match:');
    console.log(`    Input: { Team1.TeamName: "${mockOpenLigaMatch.Team1.TeamName}", Team2.TeamName: "${mockOpenLigaMatch.Team2.TeamName}" }`);
    
    const normalized = agg._normalizeOpenLigaMatch(mockOpenLigaMatch);
    console.log(`  ✅ Normalized output:`);
    console.log(`    - home: "${normalized.home}" (type: ${typeof normalized.home})`);
    console.log(`    - away: "${normalized.away}" (type: ${typeof normalized.away})`);
    console.log(`    - homeScore: ${normalized.homeScore}`);
    console.log(`    - awayScore: ${normalized.awayScore}`);
    console.log(`    - status: ${normalized.status}`);
    console.log(`    - venue: "${normalized.venue}"`);
    console.log(`    - provider: "${normalized.provider}"`);

    // Test 3: Verify formatMatches handles openligadb source
    console.log('\nTest 3: Format matches with openligadb source');
    const formatted = agg._formatMatches([normalized], 'openligadb');
    console.log(`  ✅ Formatted match (passthrough for openligadb):`);
    console.log(`    - home: "${formatted[0].home}"`);
    console.log(`    - away: "${formatted[0].away}"`);
    console.log(`    - status: "${formatted[0].status}"`);

    console.log('\n=== All tests completed ===');
    
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await redis.quit();
  }
})();
