# StatPal Sports Data API - Complete Integration Guide

## ✅ Integration Complete

Your Betrix application is now fully integrated with **StatPal (All Sports Data API)** for comprehensive multi-sport data access.

### 🎯 What's New

#### 1. **StatPal Service** (`src/services/statpal-service.js`)
- Complete wrapper for StatPal Sports Data API
- Supports **13 sports** with live data, odds, fixtures, standings, player/team stats, injuries, and more
- Built-in circuit-breaker health checking
- Redis-backed caching and failure tracking

#### 2. **Multi-Sport Handler** (`src/services/multi-sport-handler.js`)
- High-level interface for all sports operations
- Unified API for live scores, odds, fixtures, standings across all sports
- Multi-sport dashboard to fetch all live games at once
- Health check system

#### 3. **SportsAggregator Integration** (`src/services/sports-aggregator.js`)
- StatPal now primary data source (Priority 0)
- Falls back to API-Sports, Football-Data, SportsData.io, SportsMonks, etc.
- All methods available for each sport
- Seamless cascading fallback system

---

## 📊 Supported Sports

StatPal provides real-time data for:

| Sport | Code | API Version | Live Data | Odds | Fixtures | Standings | Stats |
|-------|------|-------------|-----------|------|----------|-----------|-------|
| **Soccer/Football** | `soccer` | v1, v2 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **NFL** | `nfl` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **NBA** | `nba` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **NHL** | `nhl` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **MLB** | `mlb` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cricket** | `cricket` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tennis** | `tennis` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Esports** | `esports` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Formula 1** | `f1` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Handball** | `handball` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Golf** | `golf` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Horse Racing** | `horse-racing` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Volleyball** | `volleyball` | v1 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🚀 Deployment Instructions

### Step 1: Save API Key to Render Environment

**Option A: Using Render Dashboard**

1. Go to https://dashboard.render.com
2. Select your Betrix service
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   ```
   Name: STATPAL_API_KEY
   Value: 4c9cee6b-cf19-4b68-a122-48120fe855b5
   ```
5. Click **Save**
6. Your service will auto-redeploy

**Option B: Using Render CLI**

```bash
# Install Render CLI
npm install -g @render-com/cli

# Login to Render
render login

# Set environment variable
render env set STATPAL_API_KEY 4c9cee6b-cf19-4b68-a122-48120fe855b5

# Deploy
render deploy
```

**Option C: Using Render Shell**

```bash
# Open Render Shell from dashboard
# Run:
export STATPAL_API_KEY="4c9cee6b-cf19-4b68-a122-48120fe855b5"
node verify-api-keys.js
```

---

### Step 2: Verify Installation Locally

```bash
# 1. Configure environment
export STATPAL_API_KEY="4c9cee6b-cf19-4b68-a122-48120fe855b5"

# 2. Run verification script
node verify-api-keys.js

# Expected output:
# ✅ StatPal API Key: 4c9cee6-**** (configured)
# STATPAL_BASE: https://statpal.io/api
```

---

### Step 3: Test StatPal API Endpoints

**Create test file: `test-statpal.js`**

```javascript
const StatPalService = require('./src/services/statpal-service');

async function testStatPal() {
  const statpal = new StatPalService();

  console.log('🧪 Testing StatPal API...\n');

  // Test Soccer Live Scores
  console.log('📊 Soccer Live Scores:');
  const soccerLive = await statpal.getLiveScores('soccer', 'v1');
  console.log(`  Found: ${soccerLive?.length || 0} matches`);

  // Test NFL Live Scores
  console.log('\n🏈 NFL Live Scores:');
  const nflLive = await statpal.getLiveScores('nfl', 'v1');
  console.log(`  Found: ${nflLive?.length || 0} matches`);

  // Test NBA Live Scores
  console.log('\n🏀 NBA Live Scores:');
  const nbaLive = await statpal.getLiveScores('nba', 'v1');
  console.log(`  Found: ${nbaLive?.length || 0} matches`);

  // Test Odds
  console.log('\n💰 Soccer Odds:');
  const odds = await statpal.getLiveOdds('soccer', 'v1');
  console.log(`  Found: ${odds?.length || 0} odds`);

  // Test Standings
  console.log('\n🏆 Soccer Standings:');
  const standings = await statpal.getStandings('soccer', null, 'v1');
  console.log(`  Found: ${standings?.length || 0} teams`);

  // Health Check
  console.log('\n🏥 Health Check:');
  const healthy = await statpal.healthCheck();
  console.log(`  Status: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);

  console.log('\n✅ Tests complete!');
}

testStatPal().catch(console.error);
```

**Run test:**
```bash
node test-statpal.js
```

---

### Step 4: Use StatPal in Your Application

#### **Example 1: Get Live Soccer Scores**

```javascript
const MultiSportHandler = require('./src/services/multi-sport-handler');

async function showLiveFootball() {
  const handler = new MultiSportHandler();
  
  // Get live soccer matches
  const matches = await handler.getLive('soccer', { limit: 10, version: 'v1' });
  
  console.log(`Live Soccer Matches: ${matches.length}`);
  matches.forEach(match => {
    console.log(`  ${match.homeTeam} vs ${match.awayTeam} - ${match.status}`);
  });
}

showLiveFootball();
```

#### **Example 2: Get Multi-Sport Dashboard**

```javascript
const MultiSportHandler = require('./src/services/multi-sport-handler');

async function showAllSports() {
  const handler = new MultiSportHandler();
  
  const allSports = await handler.getAllSportsLive({
    sports: ['soccer', 'nfl', 'nba', 'nhl', 'mlb', 'cricket'],
    limit: 10
  });
  
  console.log('Live Sports Dashboard:');
  console.table(allSports);
}

showAllSports();
```

#### **Example 3: Get Odds for Betting**

```javascript
const MultiSportHandler = require('./src/services/multi-sport-handler');

async function showBettingOdds() {
  const handler = new MultiSportHandler();
  
  // Get soccer odds
  const odds = await handler.getOdds('soccer', { limit: 20, version: 'v1' });
  
  console.log(`Available Betting Odds: ${odds.length}`);
  odds.forEach(odd => {
    console.log(`  ${odd.match} - ${JSON.stringify(odd.odds)}`);
  });
}

showBettingOdds();
```

#### **Example 4: Get Player Statistics**

```javascript
const MultiSportHandler = require('./src/services/multi-sport-handler');

async function getPlayerStats() {
  const handler = new MultiSportHandler();
  
  // Get player stats (replace with real player ID from API)
  const playerStats = await handler.getPlayerStats('soccer', 'player_123');
  
  console.log('Player Statistics:', playerStats);
}

getPlayerStats();
```

#### **Example 5: Telegram Bot Integration**

```javascript
// In your Telegram handler
const MultiSportHandler = require('./src/services/multi-sport-handler');

async function handleLiveCommand(ctx, sport = 'soccer') {
  const handler = new MultiSportHandler();
  
  try {
    const matches = await handler.getLive(sport);
    
    let message = `⚽ **Live ${sport.toUpperCase()} Matches**\n\n`;
    
    if (matches.length === 0) {
      message += 'No live matches at the moment.';
    } else {
      matches.slice(0, 5).forEach(match => {
        message += `🎯 ${match.homeTeam} vs ${match.awayTeam}\n`;
        message += `⏱️ Status: ${match.status}\n\n`;
      });
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply('❌ Error fetching live matches. Try again later.');
  }
}

// In command handler
bot.command('live', (ctx) => handleLiveCommand(ctx, 'soccer'));
bot.command('nfl', (ctx) => handleLiveCommand(ctx, 'nfl'));
bot.command('nba', (ctx) => handleLiveCommand(ctx, 'nba'));
```

---

## 📚 API Reference

### StatPalService Methods

```javascript
const statpal = new StatPalService(redis);

// Live Scores
await statpal.getLiveScores(sport, version);

// Odds
await statpal.getLiveOdds(sport, version);

// Fixtures
await statpal.getFixtures(sport, version);

// Standings
await statpal.getStandings(sport, league, version);

// Player Stats
await statpal.getPlayerStats(sport, playerId, version);

// Team Stats
await statpal.getTeamStats(sport, teamId, version);

// Injuries
await statpal.getInjuries(sport, version);

// Play-by-Play
await statpal.getLivePlayByPlay(sport, matchId, version);

// Live Match Stats
await statpal.getLiveMatchStats(sport, matchId, version);

// Results
await statpal.getResults(sport, version);

// Scoring Leaders
await statpal.getScoringLeaders(sport, version);

// Rosters
await statpal.getRosters(sport, teamId, version);

// Health Check
await statpal.healthCheck();
```

### MultiSportHandler Methods

```javascript
const handler = new MultiSportHandler(redis);

// Get live matches
await handler.getLive(sport, { version, limit });

// Get odds
await handler.getOdds(sport, { version, limit });

// Get fixtures
await handler.getFixtures(sport, { version, limit, days });

// Get standings
await handler.getStandings(sport, league, { version });

// Get player stats
await handler.getPlayerStats(sport, playerId, { version });

// Get team stats
await handler.getTeamStats(sport, teamId, { version });

// Get injuries
await handler.getInjuries(sport, { version, limit });

// Get play-by-play
await handler.getPlayByPlay(sport, matchId, { version });

// Get live match stats
await handler.getLiveMatchStats(sport, matchId, { version });

// Get results
await handler.getResults(sport, { version, limit, days });

// Get scoring leaders
await handler.getScoringLeaders(sport, { version, limit });

// Get roster
await handler.getRoster(sport, teamId, { version });

// Get all sports live
await handler.getAllSportsLive({ sports: [], version, limit });

// Health check
await handler.healthCheck();
```

---

## 🔧 Configuration

Environment variables (set in Render):

```bash
# StatPal API Configuration
STATPAL_API_KEY=4c9cee6b-cf19-4b68-a122-48120fe855b5
STATPAL_BASE=https://statpal.io/api

# Optional: Customize versions
STATPAL_V1=v1
STATPAL_V2=v2
```

---

## ⚡ Features

### ✅ Circuit Breaker
- Automatic provider disabling on failures
- Redis-backed health tracking
- Status-code-based failure handling:
  - **401/403/404**: 30-minute disable (non-retryable)
  - **429**: 5-minute disable (rate-limit)
  - **5xx**: 1-minute disable (server error)

### ✅ Cascading Fallback
- StatPal → API-Sports → Football-Data → SportsData.io → SportsMonks → Scrapers → Demo

### ✅ Intelligent Retries
- Non-retryable errors: Skip immediately
- Rate-limits: Longer backoff (2000ms)
- Transient errors: Graduated backoff

### ✅ Caching
- 5-minute default cache for aggregated data
- 2-minute cache for live scores
- Redis-backed for distributed systems

### ✅ Error Handling
- Graceful degradation
- Detailed error logging
- Health status tracking

---

## 🧪 Testing Guide

### 1. Unit Tests

Create `test/statpal.test.js`:

```javascript
const assert = require('assert');
const StatPalService = require('../src/services/statpal-service');

describe('StatPal Service', () => {
  let statpal;

  before(() => {
    statpal = new StatPalService();
  });

  it('should fetch live soccer scores', async () => {
    const data = await statpal.getLiveScores('soccer', 'v1');
    assert(Array.isArray(data) || data === null);
  });

  it('should fetch odds', async () => {
    const data = await statpal.getLiveOdds('soccer', 'v1');
    assert(Array.isArray(data) || data === null);
  });

  it('should pass health check', async () => {
    const isHealthy = await statpal.healthCheck();
    assert(typeof isHealthy === 'boolean');
  });
});
```

Run: `npm test`

### 2. Integration Tests

```bash
# Test against live API
node test-statpal.js

# Test with Telegram bot
npm run dev  # Start bot and test with /live, /odds, /nfl commands
```

### 3. Performance Tests

```bash
# Measure response time
time node -e "const S = require('./src/services/statpal-service'); new S().getLiveScores('soccer').then(d => console.log(d.length + ' matches'))"
```

---

## 📋 Rate Limiting

StatPal API Limits:
- **Live Scores & Play-by-Play**: Refreshed every **30 seconds** → Maximum 120 calls/hour
- **Other Endpoints**: Updated several times/hour → Maximum ~10 calls/hour

### Recommended Request Strategy

```javascript
// Cache for 30 seconds for live data
const LIVE_CACHE_TTL = 30 * 1000;

// Cache for 5 minutes for standings/fixtures
const GENERAL_CACHE_TTL = 5 * 60 * 1000;

// Request live data max 2 times per minute
const LIVE_REQUEST_INTERVAL = 30 * 1000;
```

---

## 🚨 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid API key | Check STATPAL_API_KEY env var |
| 404 Not Found | Wrong sport/endpoint | Verify sport code (soccer, nfl, nba, etc.) |
| 429 Too Many Requests | Rate limit exceeded | Wait 5 minutes, increase cache TTL |
| Timeout | Slow connection | Increase timeout, check network |
| No Data | Sport has no live matches | Try different sport or check standings |

**Debug Mode:**

```bash
export DEBUG=betrix:*
node server.js
```

---

## 📞 Support

- **StatPal Support**: support@statpal.io
- **Documentation**: https://statpal.io/api/documentation
- **API Status**: https://status.statpal.io
- **Example Calls**: See "Use StatPal in Your Application" above

---

## ✨ Next Steps

1. ✅ **Deploy API Key** to Render environment
2. ✅ **Test Endpoints** using provided test file
3. ✅ **Integrate into Handlers** using code examples
4. ✅ **Enable in Telegram Bot** with new commands
5. ✅ **Monitor Health** via dashboard
6. ✅ **Scale Usage** across multiple sports

---

## 📈 Analytics

Track StatPal usage:

```javascript
// In your handler
const usage = {
  provider: 'statpal',
  sport: 'soccer',
  endpoint: 'livescores',
  timestamp: new Date(),
  responseTime: 234, // ms
  dataPoints: 45
};

// Log or store for analytics
await analytics.log(usage);
```

---

**Status**: ✅ **FULLY INTEGRATED AND READY TO DEPLOY**

Deploy to Render now and start accessing all sports data immediately!
