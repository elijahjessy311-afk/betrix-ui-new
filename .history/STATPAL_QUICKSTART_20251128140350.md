# StatPal Integration - QUICK START GUIDE 🚀

**Status**: ✅ READY TO DEPLOY IN 5 MINUTES

---

## ⚡ Super Quick Setup (2 minutes)

### 1. Set Environment Variable on Render

Go to: **https://dashboard.render.com → Betrix Service → Settings → Environment Variables**

Add:
```
Name: STATPAL_API_KEY
Value: 4c9cee6b-cf19-4b68-a122-48120fe855b5
```

Click **Save** (auto-redeploys)

### 2. Verify Deployment (1 minute)

Wait for Render to redeploy (watch logs), then test:

```bash
# In Render Shell:
export STATPAL_API_KEY="4c9cee6b-cf19-4b68-a122-48120fe855b5"
node validate-statpal-integration.js
```

Expected output: ✅ ALL CHECKS PASSED

### 3. Test in Telegram Bot (1 minute)

Send to bot: `/live`

Expected: Live football scores appear instantly ⚽

---

## 📊 What's Now Available

**13 Sports**, All Real-Time:

```
Soccer/Football | NFL | NBA | NHL | MLB | Cricket | Tennis
Esports | Formula 1 | Handball | Golf | Horse Racing | Volleyball
```

**For Each Sport**:
- ⚡ Live Scores
- 💰 Live Odds
- 📅 Fixtures
- 🏆 Standings
- 👤 Player Stats
- 🏢 Team Stats
- 🏥 Injuries
- ▶️ Play-by-Play
- 📈 Match Stats
- 📋 Results
- ⭐ Scoring Leaders
- 📑 Rosters

---

## 💻 For Developers

### Use in Code

```javascript
// Get live football scores
const MultiSportHandler = require('./src/services/multi-sport-handler');
const handler = new MultiSportHandler();
const soccer = await handler.getLive('soccer');

// Get all sports at once
const all = await handler.getAllSportsLive({
  sports: ['soccer', 'nfl', 'nba'],
  limit: 10
});

// Get odds for betting
const odds = await handler.getOdds('soccer');

// Get player stats
const stats = await handler.getPlayerStats('soccer', 'player_id');
```

### Add Telegram Commands

```javascript
bot.command('live', async (ctx) => {
  const handler = new MultiSportHandler();
  const matches = await handler.getLive('soccer', { limit: 5 });
  
  if (!matches.length) {
    return ctx.reply('No live matches 😴');
  }
  
  let text = '⚽ **LIVE MATCHES**\n\n';
  matches.forEach(m => {
    text += `${m.homeTeam} vs ${m.awayTeam} - ${m.status}\n`;
  });
  
  ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('nfl', async (ctx) => {
  const handler = new MultiSportHandler();
  const matches = await handler.getLive('nfl', { limit: 5 });
  ctx.reply(`🏈 NFL: ${matches.length} live games`);
});

bot.command('nba', async (ctx) => {
  const handler = new MultiSportHandler();
  const matches = await handler.getLive('nba', { limit: 5 });
  ctx.reply(`🏀 NBA: ${matches.length} live games`);
});

bot.command('odds', async (ctx) => {
  const handler = new MultiSportHandler();
  const odds = await handler.getOdds('soccer', { limit: 5 });
  ctx.reply(`💰 Available odds: ${odds.length}`);
});
```

---

## 🔗 Documentation

**Complete Guides**:
- 📖 `STATPAL_INTEGRATION_GUIDE.md` - Full reference
- 📋 `STATPAL_IMPLEMENTATION_SUMMARY.md` - Technical details
- ✅ `validate-statpal-integration.js` - Validation script

**API Reference**:
- 📘 `src/services/statpal-service.js` - Core service (all methods)
- 🎯 `src/services/multi-sport-handler.js` - High-level handler
- 🔄 `src/services/sports-aggregator.js` - Integration point

---

## 🧪 Testing

### Run Validation
```bash
node validate-statpal-integration.js
```

Tests:
- Configuration ✅
- Service instantiation ✅
- All 13 sports ✅
- 9 API endpoints ✅
- Health check ✅
- Multi-sport handler ✅
- Deployment readiness ✅

### Manual Test
```bash
# Soccer
node -e "const S = require('./src/services/statpal-service'); new S().getLiveScores('soccer').then(d => console.log(d.length + ' matches'))"

# NFL
node -e "const S = require('./src/services/statpal-service'); new S().getLiveScores('nfl').then(d => console.log(d.length + ' games'))"

# NBA
node -e "const S = require('./src/services/statpal-service'); new S().getLiveScores('nba').then(d => console.log(d.length + ' games'))"
```

---

## 🚀 Deployment Checklist

- [ ] API Key: `STATPAL_API_KEY=4c9cee6b-cf19-4b68-a122-48120fe855b5` set in Render
- [ ] Files created:
  - [ ] `src/services/statpal-service.js`
  - [ ] `src/services/multi-sport-handler.js`
  - [ ] `validate-statpal-integration.js`
- [ ] Files modified:
  - [ ] `src/config.js` (added StatPal config)
  - [ ] `src/services/sports-aggregator.js` (added integration)
- [ ] Validation passes: `node validate-statpal-integration.js` ✅
- [ ] Deployed to Render: `git push origin main`
- [ ] Render auto-redeploy complete (check dashboard)
- [ ] Telegram bot tested: `/live` returns matches
- [ ] Multiple sports tested: `/nfl`, `/nba`, `/odds`

---

## 📊 Usage Examples

### Example 1: Multi-Sport Dashboard
```javascript
const handler = new MultiSportHandler();
const dashboard = await handler.getAllSportsLive({
  sports: ['soccer', 'nfl', 'nba', 'nhl', 'mlb'],
  limit: 5
});

Object.entries(dashboard).forEach(([sport, data]) => {
  console.log(`${sport}: ${data.count} live matches`);
});
```

Output:
```
soccer: 12 live matches
nfl: 2 live games
nba: 5 live games
nhl: 3 live games
mlb: 4 live games
```

### Example 2: Real-Time Updates
```javascript
// Refresh live scores every 30 seconds
setInterval(async () => {
  const handler = new MultiSportHandler();
  const matches = await handler.getLive('soccer');
  console.log(`Updated: ${matches.length} matches`);
  
  // Send to users, update dashboard, etc.
  updateUI(matches);
}, 30000);
```

### Example 3: Betting Odds
```javascript
const handler = new MultiSportHandler();
const odds = await handler.getOdds('soccer', { limit: 20 });

odds.forEach(odd => {
  console.log(`Match: ${odd.match}`);
  console.log(`  Home: ${odd.homeOdds}`);
  console.log(`  Draw: ${odd.drawOdds}`);
  console.log(`  Away: ${odd.awayOdds}`);
  console.log(`  Bookmaker: ${odd.bookmaker}`);
});
```

---

## ⚠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| `Error: API key not found` | Set `STATPAL_API_KEY` in Render env vars |
| `401 Unauthorized` | Check key is set correctly, not expired |
| `404 Not Found` | Verify sport code (soccer, nfl, nba, etc.) |
| `429 Too Many Requests` | Wait 5 min, increase cache to 5min, reduce calls |
| No data returned | Sport may have no live events, try different sport |
| Service timeout | Check internet, try again, increase timeout to 10s |

**Debug Mode**:
```bash
export DEBUG=betrix:*
node server.js
```

---

## 🆘 Support

Need help? Check:

1. **Full Guide**: `STATPAL_INTEGRATION_GUIDE.md`
2. **Code Docs**: Read comments in `statpal-service.js`
3. **Examples**: See "Usage Examples" above
4. **Validation**: Run `node validate-statpal-integration.js`
5. **Logs**: Check Render dashboard logs

StatPal Support: support@statpal.io

---

## ✨ What Happens After Deploy

1. **Immediate**: All sports data instantly available via API
2. **Auto**: Circuit-breaker protection activated
3. **Smart**: Falls back to API-Sports if StatPal down
4. **Fast**: 30-second cache for live scores
5. **Reliable**: Health tracking and automatic disabling

---

## 🎯 Success Criteria

After deployment, you should see:

- ✅ Telegram `/live` command returns football scores
- ✅ `/nfl` returns NFL games
- ✅ `/nba` returns NBA games
- ✅ `/odds` returns betting odds
- ✅ `/standings` returns league tables
- ✅ Response time < 1 second
- ✅ No error logs related to StatPal
- ✅ Validation script passes all checks

---

**🎉 You're all set! Deploy now and enjoy all sports data.**

**Estimated time**: 5 minutes from start to live data  
**Risk**: Very Low (additive, non-breaking)  
**Rollback**: Easy (revert commit if needed)

**Let's go!** 🚀
