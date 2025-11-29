# ⚡ QUICK REFERENCE CARD — BETRIX Bot Deployment

**Print this or keep it open while deploying**

---

## 🎯 The 4-Step Deploy

### Step 1️⃣: TLS (If Behind Proxy)
```powershell
# Get .cer from IT, then:
.\docs\dev-scripts\install-proxy-ca.ps1 -CertPath 'C:\path\to\ca.cer'

# Verify:
node scripts/inspect-sportmonks-cert.js
```

### Step 2️⃣: Environment
```powershell
# Interactive:
.\scripts\setup-production-env.ps1

# Answer:
# - TELEGRAM_TOKEN
# - REDIS_URL
# - SPORTSMONKS_API
```

### Step 3️⃣: Start Worker
```bash
node src/worker-final.js
# Leave this terminal open
```

### Step 4️⃣: Validate
```bash
# In NEW terminal:
node scripts/validate-telegram-live.js

# Then in Telegram:
# Send: /live
# Expect: Real match names ✅
```

---

## 🔧 Environment Variables

| Variable | Example | Where to Get |
|----------|---------|--------------|
| `TELEGRAM_TOKEN` | `123456:ABCdef...` | [@BotFather](https://t.me/botfather) |
| `REDIS_URL` | `redis://default:pwd@host:6379` | Redis admin or cloud provider |
| `SPORTSMONKS_API` | `abc123xyz...` | [sportmonks.com](https://sportmonks.com) |

---

## 🆘 Common Issues (Quick Fix)

| Problem | Fix |
|---------|-----|
| "Unknown vs Unknown" | Check `SPORTSMONKS_API` token |
| No response to `/live` | Ensure worker running: `redis-cli GET worker:heartbeat` |
| "NOAUTH" in logs | Wrong Redis password; re-run `.\scripts\setup-production-env.ps1` |
| TLS error | Run `.\docs\dev-scripts\install-proxy-ca.ps1` |
| Redis refused | Test: `redis-cli PING` should return `PONG` |

---

## ✅ Health Checks (Daily)

```bash
# 1. Worker heartbeat (should show timestamp)
redis-cli GET worker:heartbeat

# 2. Test bot (/live in Telegram)
# Should show real match names

# 3. Check logs
# No NOAUTH, no TLS errors, no unhandled rejections
```

---

## 📚 Full Guides (By Time)

| Time | Guide | What It Has |
|------|-------|------------|
| 5 min | [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) | One-page overview |
| 15-30 min | [QUICKSTART_DEPLOY.md](QUICKSTART_DEPLOY.md) | Fast walkthrough |
| 30-45 min | [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) | Detailed steps |
| Ref | [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) | Enterprise checklist |
| Ref | [ARCHITECTURE_DEPLOYMENT.md](ARCHITECTURE_DEPLOYMENT.md) | Diagrams & flows |

---

## 🚀 Deployment Targets

### Local Development
```bash
node src/worker-final.js
# Test with /live command in Telegram
```

### Heroku
```bash
# 1. Set config in dashboard
# 2. git push heroku main
# 3. heroku ps:scale worker=1
```

### Railway / Render
```bash
# 1. Set env vars in platform dashboard
# 2. Deploy: git push (auto-deploy) or manual
# 3. Start worker process
```

### Linux (systemd)
```bash
# 1. Create /etc/systemd/system/betrix-worker.service
# 2. sudo systemctl enable betrix-worker
# 3. sudo systemctl start betrix-worker
```

### Docker
```bash
docker run -d \
  -e TELEGRAM_TOKEN="$TOKEN" \
  -e REDIS_URL="$REDIS" \
  -e SPORTSMONKS_API="$API" \
  betrix-bot node src/worker-final.js
```

---

## 🔍 Diagnostic Commands

```bash
# Test SportMonks API
node scripts/test-sportmonks-axios.js

# Test handler
node scripts/test-match-callback.js

# Full validation
node scripts/validate-telegram-live.js

# Check TLS certificate
node scripts/inspect-sportmonks-cert.js

# Redis status
redis-cli PING                    # Should return: PONG
redis-cli GET worker:heartbeat    # Should return: timestamp
redis-cli LLEN telegram:updates    # Queue length
redis-cli DBSIZE                  # Total keys
```

---

## 📋 Pre-Deploy Checklist

- [ ] Node.js v20+ installed
- [ ] Redis accessible and authenticated
- [ ] Telegram token generated
- [ ] SportMonks token obtained
- [ ] (If behind proxy) Proxy CA cert available
- [ ] Code is latest main branch
- [ ] Dependencies installed: `npm install`

---

## 🎯 Success Looks Like

✅ Worker running without errors  
✅ `redis-cli GET worker:heartbeat` shows timestamp  
✅ `/live` command in Telegram returns real match names  
✅ Clicking match button edits the message  
✅ No "Unknown vs Unknown" placeholders  
✅ No NOAUTH, TLS, or unhandled rejection errors  

---

## 📞 Getting Help

**Lost?** → Open [DEPLOYMENT_INDEX.md](DEPLOYMENT_INDEX.md)

**Want fast?** → Follow [QUICKSTART_DEPLOY.md](QUICKSTART_DEPLOY.md)

**Want details?** → Read [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)

**Troubleshooting?** → Check [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)

**Visual learner?** → See [ARCHITECTURE_DEPLOYMENT.md](ARCHITECTURE_DEPLOYMENT.md)

---

## 🚀 Time Estimates

| Task | Time |
|------|------|
| TLS setup (if needed) | 5-15 min |
| Env configuration | 5 min |
| Start worker | 2 min |
| Validation | 5 min |
| **Total** | **15-30 min** |

---

## ⚡ One-Liner Commands

```bash
# Full validation in one command
TELEGRAM_TOKEN=$TOKEN REDIS_URL=$REDIS SPORTSMONKS_API=$API node scripts/validate-telegram-live.js

# Test SportMonks directly
curl -s "https://api.sportmonks.com/v3/football/livescores?api_token=$API" | head -c 500

# Check all env vars set
echo "TOKEN: $TELEGRAM_TOKEN" && echo "REDIS: $REDIS_URL" && echo "SPORT: $SPORTSMONKS_API"

# Start worker with env file
set -o allexport; source .env; set +o allexport; node src/worker-final.js
```

---

## 🎉 Ready?

1. **Print this card** (or keep open)
2. **Follow 4 steps** at the top
3. **Use quick fixes** if issues
4. **Check daily** with health checks
5. **Done!** 🚀

---

**Questions?** Check the docs. **Stuck?** Run the validation script. **All good?** You're live! 🎊
