# 🚀 BETRIX Quick Start Guide

Get BETRIX running locally in **15 minutes** with all production features.

## ⏱️ 15-Minute Setup

### Step 1: Prerequisites (2 min)

**Required:**
- [Node.js ≥ 20](https://nodejs.org/) - Download and install
- [Redis](https://redis.io/) - Install locally or use [Upstash](https://upstash.com/) (free cloud option)
- [Telegram Bot Token](https://t.me/BotFather) - Create bot via @BotFather

**Optional (for AI features):**
- [Google Gemini API Key](https://aistudio.google.com/app/apikey) - Free tier available
- Azure OpenAI credentials (if using Azure as fallback)

### Step 2: Clone & Install (3 min)

```powershell
# Clone repository
git clone https://github.com/maryreaky/betrix-ui-replit-.git
cd betrix-ui-replit-

# Install dependencies
npm install
```

### Step 3: Configure Environment (5 min)

```powershell
# Copy environment template
Copy-Item .env.example .env

# Edit .env file (use your favorite editor)
notepad .env
```

**Minimal `.env` (required to run):**
```env
# Telegram
TELEGRAM_TOKEN=<your_bot_token_from_BotFather>
TELEGRAM_WEBHOOK_SECRET=your_secret_key_here

# Redis (local or cloud)
# Local: redis://localhost:6379
# Upstash: redis://default:password@host:6379
REDIS_URL=redis://localhost:6379

# Optional: AI Provider (uses offline mode if not set)
GEMINI_API_KEY=your_gemini_key_here
```

### Step 4: Start Services (5 min)

**Terminal 1 - Start Worker (prefetch + queue processor):**
```powershell
node src/worker-final.js
```

Expected output:
```
[WORKER] Started with AI providers: gemini
[WORKER] Prefetch loop activated (interval: 60s)
[WORKER] Listening for telegram:updates on Redis queue
[WORKER] Heartbeat: timestamp
```

**Terminal 2 - Start Web Server (HTTP + WebSocket):**
```powershell
node src/app.js
```

Expected output:
```
[HTTP] Server listening on port 5000
[WS] WebSocket initialized
[REDIS] Connected to queue and observer
[PREFETCH] Subscribing to real-time events
```

### Step 5: Test Everything Works

```powershell
# 1. Health check
curl http://localhost:5000/health

# 2. View live data sources
curl http://localhost:5000/live/leagues

# 3. Open monitor dashboard
# Visit: http://localhost:5000/monitor.html
# Should show: green status, 0 queue items, prefetch running

# 4. Send message to your bot on Telegram
# Bot will respond via AI (if GEMINI_API_KEY set) or offline mode
```

✅ **You're done!** All systems operational.

## 📊 Live Data Sources (Always Available)

No API keys needed for these:

| Source | Endpoint | Update | Free Tier |
|--------|----------|--------|-----------|
| **Leagues** | `/live/leagues` | 30s | ✓ |
| **Standings** | `/live/standings?league=BL` | 30s | ✓ |
| **Sports News** | `/live/news` | 60s | ✓ |
| **Highlights** | `/live/highlights` | 120s | ✓ |
| **Historical Data** | `/live/fixtures?season=2024` | 1h | ✓ |

Test in browser:
```
http://localhost:5000/live/leagues
http://localhost:5000/live/news
```

## 🤖 AI Features (Optional)

### Without API Keys (Offline Mode)
- Bot receives messages
- Responds with helpful defaults
- No AI analysis, but fully functional

### With Gemini API Key
1. Get free key: https://aistudio.google.com/app/apikey
2. Add to `.env`:
   ```env
   GEMINI_API_KEY=your_key_here
   ```
3. Restart services
4. Bot now provides intelligent analysis

### Multi-Provider Fallback Chain
If Gemini fails, tries:
1. Gemini (primary)
2. Azure OpenAI (if configured)
3. HuggingFace (if token set)
4. LocalAI (if available)
5. Offline mode (default)

## 📈 Monitoring

### Real-Time Dashboard
```
http://localhost:5000/monitor.html
```
Shows:
- ✅ Server status
- 📊 Queue statistics
- 🤖 Active AI provider
- 📡 Prefetch health
- 🔄 Update frequency

### API Metrics
```powershell
# JSON API
curl http://localhost:5000/monitor

# Output:
# {
#   "status": "running",
#   "uptime": "00:15:30",
#   "queueLength": 0,
#   "aiProvider": "gemini",
#   "prefetchStatus": { ... }
# }
```

## 🧪 Run Tests

```powershell
# Run all tests (10 tests)
npm test

# Expected output:
# ✔ 10 tests passing
# Includes:
# • Cache service tests
# • Data source tests
# • Smoke tests
```

## 🌐 Next Steps

### For Development
1. Edit handlers: `src/handlers/`
2. Add new commands: `src/telegram-handler.js`
3. Customize AI: `src/ai-composite-chain.js`

### For Production
1. Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. Use managed Redis (Upstash, Redis Cloud)
3. Deploy to Render, Railway, or Heroku
4. Set up monitoring alerts

### Explore Features
- **Admin Console**: `/admin` (requires auth)
- **WebSocket Events**: Real-time prefetch updates
- **Custom Cache**: Configure intervals in `src/config/cache-config.js`
- **User Tiers**: Implement in `src/handlers/tier-handler.js`

## 🔧 Common Issues

### "Cannot connect to Redis"
```powershell
# Verify Redis is running
redis-cli ping
# Should output: PONG

# If Redis not installed, use Upstash:
# 1. Create account at https://upstash.com
# 2. Create Redis database (free tier)
# 3. Copy connection string to .env
```

### "Telegram bot not responding"
```powershell
# Verify webhook setup
curl http://localhost:5000/health

# Check worker is running (should see prefetch logs)
# Check TELEGRAM_TOKEN is correct in .env
```

### "WebSocket connection failed"
```powershell
# Verify web server is running
# Check browser console for errors
# Ensure http://localhost:5000 is accessible
```

## 📚 Documentation Structure

| File | Purpose |
|------|---------|
| **README.md** | Overview, features, architecture |
| **QUICK_START.md** | This file - 15-min setup |
| **INFRASTRUCTURE_GUIDE.md** | Complete architecture, monitoring, troubleshooting |
| **API_REFERENCE.md** | All endpoints, WebSocket, Pub/Sub channels |
| **PREFETCH_POLICY.md** | Cache strategy, backoff tuning, recommendations |
| **DEPLOYMENT_GUIDE.md** | Production deployment on Render/Heroku/Railway |

## ⚡ Pro Tips

1. **Local Redis via Docker** (if you have Docker):
   ```powershell
   docker run -d -p 6379:6379 redis:latest
   ```

2. **Watch prefetch activity** in real-time:
   ```powershell
   # Terminal 3
   redis-cli
   > SUBSCRIBE prefetch:updates
   ```

3. **Debug mode** - Add to `.env`:
   ```env
   DEBUG=betrix:*
   ```

4. **View system logs**:
   ```powershell
   # In Redis CLI
   > LRANGE system:logs 0 20
   ```

## 🎯 You Now Have

- ✅ Production-ready bot infrastructure
- ✅ Real-time live sports data (no API keys needed)
- ✅ AI-powered analysis (with fallback chain)
- ✅ Web server with API endpoints
- ✅ WebSocket real-time events
- ✅ Monitor dashboard
- ✅ Complete logging and debugging
- ✅ Scalable Redis queue system

**Start building!** 🚀
