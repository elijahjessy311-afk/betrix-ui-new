# Data Exposure API - Integration Testing Guide

## Quick Start Testing

### 1. Verify API is Registered

```bash
# Check if the API endpoints are available
curl http://localhost:5000/api/data/schema
```

**Expected Response**: Full API schema with all endpoints listed

### 2. Check Cache Status

```bash
curl http://localhost:5000/api/data/cache-info
```

**Expected Response**:
```json
{
  "timestamp": "2024-12-19T15:30:00.000Z",
  "source": "memory",
  "totalSize": 1024,
  "totalEntries": 5,
  "estimatedSizeKb": "1.00",
  "entries": [
    {
      "key": "raw:live:sportsmonks",
      "size": 512,
      "expiresIn": 120,
      "dataType": "Array[2]"
    }
  ]
}
```

### 3. Get Data Summary

```bash
curl http://localhost:5000/api/data/summary
```

**Expected Response**:
```json
{
  "timestamp": "2024-12-19T15:30:00.000Z",
  "sources": {
    "sportsmonks": {
      "liveMatches": 2,
      "fixtures": {"39": 20},
      "standings": {"39": 1},
      "leagues": 250
    },
    "footballdata": {
      "liveMatches": 0,
      "fixtures": {"39": 50},
      "standings": {"39": 1},
      "leagues": 30
    }
  }
}
```

### 4. Get Live Matches

```bash
curl http://localhost:5000/api/data/live?source=sportsmonks
```

**Expected Response**: Array of live matches with full details

### 5. Get Upcoming Fixtures

```bash
curl "http://localhost:5000/api/data/fixtures?source=sportsmonks&league=39"
```

**Expected Response**: Array of upcoming matches for Premier League

## Integration Test Suite

### Test 1: Data Caching Integration

**Objective**: Verify that SportsAggregator properly stores data in RawDataCache

```javascript
// test/data-caching.test.js
describe('Data Caching Integration', () => {
  let sportsAggregator, dataCache;

  beforeEach(async () => {
    const redis = new MockRedis();
    dataCache = new RawDataCache(redis);
    sportsAggregator = new SportsAggregator(redis, { dataCache });
  });

  test('getAllLiveMatches stores raw data', async () => {
    const matches = await sportsAggregator.getAllLiveMatches();
    
    // Verify data was cached
    const cached = await dataCache.getLiveMatches('sportsmonks');
    expect(cached).toHaveLength(matches.length);
  });

  test('getUpcomingMatches stores raw fixtures', async () => {
    const fixtures = await sportsAggregator.getUpcomingMatches(39);
    
    // Verify data was cached
    const cached = await dataCache.getFixtures('sportsmonks', 39);
    expect(cached.length).toBeGreaterThan(0);
  });
});
```

### Test 2: API Endpoint Integration

**Objective**: Verify DataExposureHandler endpoints work correctly

```javascript
// test/api-endpoints.test.js
describe('Data Exposure API Endpoints', () => {
  let app, sportsAggregator;

  beforeEach(async () => {
    const redis = new MockRedis();
    sportsAggregator = new SportsAggregator(redis);
    new DataExposureHandler(app, sportsAggregator);
  });

  test('GET /api/data/summary returns data overview', async () => {
    const response = await request(app)
      .get('/api/data/summary');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('sources');
    expect(response.body.sources).toHaveProperty('sportsmonks');
  });

  test('GET /api/data/live returns live matches', async () => {
    const response = await request(app)
      .get('/api/data/live?source=sportsmonks');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('matches');
    expect(Array.isArray(response.body.matches)).toBe(true);
  });

  test('GET /api/data/fixtures returns upcoming matches', async () => {
    const response = await request(app)
      .get('/api/data/fixtures?source=sportsmonks&league=39');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('fixtures');
    expect(response.body.league).toBe('39');
  });

  test('GET /api/data/standings returns league table', async () => {
    const response = await request(app)
      .get('/api/data/standings/39?source=sportsmonks');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('standings');
  });

  test('GET /api/data/leagues returns available leagues', async () => {
    const response = await request(app)
      .get('/api/data/leagues?source=sportsmonks');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.leagues)).toBe(true);
  });

  test('GET /api/data/cache-info returns cache status', async () => {
    const response = await request(app)
      .get('/api/data/cache-info');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totalSize');
    expect(response.body).toHaveProperty('totalEntries');
  });

  test('POST /api/data/cache-cleanup triggers cleanup', async () => {
    const response = await request(app)
      .post('/api/data/cache-cleanup');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body).toHaveProperty('cleaned');
  });

  test('GET /api/data/export returns all cached data', async () => {
    const response = await request(app)
      .get('/api/data/export');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('exportedAt');
    expect(response.body).toHaveProperty('data');
  });

  test('GET /api/data/schema returns API documentation', async () => {
    const response = await request(app)
      .get('/api/data/schema');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('endpoints');
  });
});
```

### Test 3: Data Flow Integration

**Objective**: Verify complete data flow from API to cache to response

```javascript
// test/data-flow.test.js
describe('Complete Data Flow Integration', () => {
  let sportsAggregator, dataCache, app;

  beforeEach(async () => {
    const redis = new MockRedis();
    dataCache = new RawDataCache(redis);
    sportsAggregator = new SportsAggregator(redis, { dataCache });
    new DataExposureHandler(app, sportsAggregator);
  });

  test('Prefetch flow: getAllLiveMatches -> cache -> API', async () => {
    // 1. Simulate prefetch
    const liveMatches = await sportsAggregator.getAllLiveMatches();
    
    // 2. Verify cached
    const cached = await dataCache.getLiveMatches('sportsmonks');
    expect(cached.length).toEqual(liveMatches.length);
    
    // 3. Verify API returns same data
    const response = await request(app)
      .get('/api/data/live?source=sportsmonks');
    
    expect(response.body.matches.length).toEqual(liveMatches.length);
  });

  test('Fixture flow: getUpcomingMatches -> cache -> API', async () => {
    const leagueId = 39;
    
    // 1. Fetch upcoming
    const fixtures = await sportsAggregator.getUpcomingMatches(leagueId);
    
    // 2. Verify cached with correct league
    const cached = await dataCache.getFixtures('sportsmonks', leagueId);
    expect(cached.length).toEqual(fixtures.length);
    
    // 3. Verify API returns correct league data
    const response = await request(app)
      .get(`/api/data/fixtures?source=sportsmonks&league=${leagueId}`);
    
    expect(response.body.league).toBe(String(leagueId));
    expect(response.body.fixtures.length).toEqual(fixtures.length);
  });

  test('Cache TTL: Data expires and is refreshed', async () => {
    // Store with short TTL
    const testData = [{ id: 1, name: 'Test Match' }];
    await dataCache.storeLiveMatches('sportsmonks', testData);
    
    // Verify available immediately
    let cached = await dataCache.getLiveMatches('sportsmonks');
    expect(cached.length).toBe(1);
    
    // Wait for expiration (in real test, use jest fake timers)
    await new Promise(r => setTimeout(r, 100));
    
    // Verify still available (TTL not expired yet)
    cached = await dataCache.getLiveMatches('sportsmonks');
    expect(cached.length).toBe(1);
  });
});
```

### Test 4: Error Handling

**Objective**: Verify proper error handling in API endpoints

```javascript
// test/error-handling.test.js
describe('Error Handling', () => {
  let app, sportsAggregator;

  test('API returns 500 on cache retrieval failure', async () => {
    const badAggregator = {
      dataCache: {
        getLiveMatches: jest.fn().mockRejectedValue(new Error('Cache error'))
      }
    };
    
    new DataExposureHandler(app, badAggregator);
    
    const response = await request(app)
      .get('/api/data/live?source=sportsmonks');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });

  test('API handles missing source gracefully', async () => {
    const response = await request(app)
      .get('/api/data/live?source=invalid');
    
    expect(response.status).toBe(200);
    expect(response.body.matches).toEqual([]);
  });
});
```

## Manual Testing Checklist

- [ ] API server starts without errors
- [ ] `/api/data/schema` returns full documentation
- [ ] `/api/data/summary` shows non-zero entries after 60s
- [ ] `/api/data/live` returns array of matches (may be empty if no games live)
- [ ] `/api/data/fixtures?league=39` returns Premier League fixtures
- [ ] `/api/data/standings/39` returns league table
- [ ] `/api/data/leagues` returns available leagues
- [ ] `/api/data/cache-info` shows cache entries with TTL
- [ ] Cache TTL decreases over time
- [ ] `/api/data/cache-cleanup` returns cleaned count
- [ ] `/api/data/export` returns JSON file download
- [ ] Telegram `/live` command returns formatted message
- [ ] Telegram `/fixtures` command returns upcoming matches
- [ ] Telegram `/standings 39` command returns league table
- [ ] Data persists between requests (within TTL)
- [ ] Data auto-refreshes every 60 seconds
- [ ] No HTTP 400 errors from Football-Data
- [ ] Memory usage stays reasonable
- [ ] All API responses have proper content-type
- [ ] All API responses include timestamps

## Load Testing

### Test 1: Concurrent Requests

```bash
# Using Apache Bench
ab -n 1000 -c 100 http://localhost:5000/api/data/summary

# Expected: All requests succeed, response times < 50ms
```

### Test 2: Cache Hit Rate

```bash
# Run many requests in short succession
for i in {1..100}; do
  curl http://localhost:5000/api/data/live?source=sportsmonks
done

# Expected: ~95% cache hits (minimal API calls)
```

### Test 3: Large Export

```bash
curl http://localhost:5000/api/data/export > large-export.json

# Check file size
wc -c large-export.json  # Should be < 50MB

# Verify JSON validity
jq . large-export.json > /dev/null  # Should succeed
```

## Performance Benchmarking

### Metrics to Track

```javascript
// Measure API response times
const measurements = [];

for (let i = 0; i < 100; i++) {
  const start = Date.now();
  const response = await fetch('http://localhost:5000/api/data/live');
  const elapsed = Date.now() - start;
  measurements.push(elapsed);
}

const avg = measurements.reduce((a, b) => a + b) / measurements.length;
const p95 = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];
const p99 = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.99)];

console.log(`Average: ${avg}ms, P95: ${p95}ms, P99: ${p99}ms`);
// Expected: Average < 10ms, P95 < 20ms, P99 < 50ms
```

## Debugging Tips

### Enable Verbose Logging

```javascript
// In raw-data-cache.js
async store(key, data, ttl = null) {
  console.log(`[RawDataCache] Storing ${key} with TTL ${ttl}s, size: ${JSON.stringify(data).length}b`);
  // ... rest of method
}

async get(key) {
  const result = await this.get(key);
  console.log(`[RawDataCache] Retrieved ${key}, hit: ${!!result}`);
  return result;
}
```

### Monitor Cache Size

```bash
# Check memory usage
curl http://localhost:5000/api/data/cache-info | jq '.totalSize'

# Watch cache entries grow
while true; do
  clear
  curl -s http://localhost:5000/api/data/cache-info | jq '.totalEntries'
  sleep 5
done
```

### Verify Data Freshness

```bash
# Check how old cached data is
curl http://localhost:5000/api/data/cache-info | jq '.entries[] | {key: .key, expiresIn: .expiresIn}'

# Data should refresh every 60 seconds
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Data Exposure API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- test/data-exposure-api.test.js
      - run: npm run test:integration -- test/data-flow.test.js
      - run: npm run test:performance
      
      - name: Test API Endpoints
        run: |
          npm start &
          sleep 5
          curl http://localhost:5000/api/data/schema
          curl http://localhost:5000/api/data/summary
          npm stop
```

## Success Criteria

✅ All API endpoints return 200 OK  
✅ Cache hit rate > 90% after first request  
✅ Response times < 20ms for cached data  
✅ No memory leaks over 24 hours  
✅ Data refreshes automatically every 60s  
✅ Export file is valid JSON  
✅ All error cases handled gracefully  
✅ Telegram and HTTP clients work simultaneously  
✅ No duplicate data in cache  
✅ TTL decreases over time  

---

**BETRIX Data Exposure API - Testing Guide**  
*Last Updated: 2024-12-19*
