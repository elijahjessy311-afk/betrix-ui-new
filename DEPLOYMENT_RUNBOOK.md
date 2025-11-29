# BETRIX Bot Production Deployment Runbook

**Version**: 1.0 | **Date**: 2025-11-29 | **Status**: Ready for Deployment

---

## Executive Summary

The BETRIX Telegram bot has been updated to use **SportMonks** as the primary football live data provider. This runbook guides you through deploying the bot to production with real-time match data.

**What's new:**
- ✅ SportMonks integration (preferred provider for football matches)
- ✅ Real team names displayed (no more "Unknown vs Unknown")
- ✅ Clickable match details with Telegram callbacks
- ✅ Redis-backed queue system for reliable message processing
- ✅ TLS certificate verification guidance for corporate proxies

---

## Pre-Deployment Checklist

- [ ] **Code**: Latest main branch deployed (`git pull origin main`)
- [ ] **Node.js**: v20+ installed (`node --version`)
- [ ] **Redis**: Accessible and authenticated (test with `redis-cli PING`)
- [ ] **Telegram Bot Token**: Generated from [@BotFather](https://t.me/botfather)
- [ ] **SportMonks API Token**: Obtained from [sportmonks.com](https://sportmonks.com)
- [ ] **Network Access**: Outbound HTTPS to `api.sportmonks.com` allowed
- [ ] **TLS Certificates**: (If behind proxy) CA certificate installed or host allowlisted

---

## Deployment Steps

### 1. Prepare Environment (10 min)

#### 1a. Clone or Update Repository

```bash
# If first time:
git clone https://github.com/maryreaky/betrix-ui-replit-.git
cd betrix-ui-replit-

# Or if already cloned:
git pull origin main
```

#### 1b. Install Dependencies

```bash
npm install
```

#### 1c. Set Up Environment Variables

**Option 1: Interactive Setup (Recommended for Windows)**

```powershell
.\scripts\setup-production-env.ps1
```

Prompts for: `TELEGRAM_TOKEN`, `REDIS_URL`, `SPORTSMONKS_API`

**Option 2: Manual .env File**

```bash
cp .env.example .env
# Edit .env with your credentials
cat .env  # Verify
```

**Option 3: Export to Session (Linux/macOS)**

```bash
export TELEGRAM_TOKEN="your_telegram_bot_token"
export REDIS_URL="redis://default:password@redis-host:6379"
export SPORTSMONKS_API="your_sportmonks_token"
```

#### 1d. Verify Variables

```bash
# Show (masked) values:
echo "TELEGRAM_TOKEN: ${TELEGRAM_TOKEN:0:10}***"
echo "REDIS_URL: ${REDIS_URL:0:30}***"
echo "SPORTSMONKS_API: ${SPORTSMONKS_API:0:10}***"

# All must be non-empty
```

---

### 2. Resolve TLS Certificate Issues (5-15 min, if applicable)

**Is your network behind a corporate proxy?**

#### If YES: Install Proxy CA

1. **Obtain proxy CA certificate** (`.cer` or `.pem`) from your IT/security team

2. **Run installation helper:**
   ```powershell
   .\docs\dev-scripts\install-proxy-ca.ps1 -CertPath 'C:\path\to\proxy-ca.cer'
   ```

3. **Verify installation:**
   ```bash
   node scripts/inspect-sportmonks-cert.js
   ```

   Expected: Certificate shows **SportMonks CA issuer**, not your proxy.

#### If NO: Skip TLS Setup

> You have direct internet access. TLS verification will work automatically.

---

### 3. Start the Worker (2 min)

The worker process handles the Telegram message queue and prefetch scheduler.

```bash
node src/worker-final.js
```

**Expected startup logs:**
```
[Worker] Started: BRPOPLPUSH queue handler
[Redis] Connected to redis://default:...@host:6379
[Worker] Prefetch scheduler running (60s interval)
[Sports] Aggregator ready (SportMonks primary for football)
✓ System initialized and ready
```

> **Keep this terminal open.** The worker must be running for the bot to respond.

---

### 4. Validate Bot is Working (5 min)

**Open a new terminal** and run:

```bash
cd betrix-ui-replit-
node scripts/validate-telegram-live.js
```

**Expected output:**
```
✅ All required env vars set
✅ Redis connected: PONG
✅ SportMonks API responded with 37 live matches
✅ Handler returned a response
✅ Real team names detected (not placeholders)
```

**If validation fails:**
- Check error message carefully (see Troubleshooting section below)
- Ensure worker is still running in the other terminal
- Review worker logs for errors

---

### 5. Manual Telegram Test (2 min)

1. **Open Telegram** and find your bot (use @username from @BotFather)

2. **Send command**: `/live`

3. **Expected response**:
   ```
   📊 Live Matches (Football):
   
   1️⃣ Manchester City vs Liverpool
   2️⃣ Bayern Munich vs Borussia Dortmund
   3️⃣ Real Madrid vs Barcelona
   
   [Button: Details] [Button: Details] [Button: Details]
   ```

4. **Click a match button** to see details

5. **Expected edit**: Message updates with match score, status, and stats

### If Bot Doesn't Respond:

- ✅ Confirm worker terminal shows no errors
- ✅ Check `TELEGRAM_TOKEN` is set correctly
- ✅ Verify webhook is registered (if applicable)
- ✅ Run: `redis-cli GET worker:heartbeat` (should return recent timestamp)

---

### 6. Monitor Ongoing Health (Daily)

#### Check Worker Heartbeat

```bash
redis-cli GET worker:heartbeat
# Should return timestamp like: "2025-11-29T12:34:56Z"
```

#### Review Recent Logs

```bash
# In worker terminal, check for:
# - No "NOAUTH" errors (Redis auth working)
# - No TLS certificate errors (TLS working)
# - No unhandled promise rejections
```

#### Periodic Telegram Test

```bash
# Send /live periodically to confirm real data is flowing
# Teams should match live matches (check ESPN/official sources)
```

---

## Troubleshooting

### Problem: `/live` returns "Unknown vs Unknown"

**Diagnosis:**
```bash
# 1. Check SportMonks API is reachable:
node scripts/test-sportmonks-axios.js

# 2. Verify token is correct:
echo "Token: $SPORTSMONKS_API"
```

**Solutions:**
- [ ] Verify `SPORTSMONKS_API` token is correct
- [ ] Check SportMonks API is returning data (run diagnostics above)
- [ ] Ensure worker is running (`redis-cli GET worker:heartbeat` shows timestamp)
- [ ] Review worker logs for `sportmonks-service` errors

### Problem: Bot doesn't respond to `/live`

**Diagnosis:**
```bash
# 1. Check worker is running:
redis-cli GET worker:heartbeat

# 2. Check Telegram token is set:
echo "TELEGRAM_TOKEN: ${TELEGRAM_TOKEN:0:10}***"

# 3. Check queue is being processed:
redis-cli LLEN telegram:updates
redis-cli LLEN telegram:processing
```

**Solutions:**
- [ ] Ensure worker process is running
- [ ] Verify `TELEGRAM_TOKEN` is correct
- [ ] Check webhook is registered with Telegram
- [ ] Review worker logs for message processing errors

### Problem: "NOAUTH" errors in logs

**Diagnosis:**
```bash
# Test Redis connection directly:
redis-cli PING
# If returns "NOAUTH", password is needed

redis-cli -u "redis://default:wrongpassword@host:6379" PING
# If fails, password is incorrect
```

**Solutions:**
- [ ] Verify `REDIS_URL` format: `redis://default:PASSWORD@HOST:PORT`
- [ ] Check password is correct (no typos)
- [ ] Re-run setup script: `.\scripts\setup-production-env.ps1`
- [ ] Test with `redis-cli -u "$REDIS_URL" PING` (should return "PONG")

### Problem: TLS Certificate Errors

**Example error:**
```
Error: unable to verify the first certificate
...at Protocol.getError (/usr/lib/node_modules/axios/...)
```

**Diagnosis:**
```bash
# Check certificate chain:
node scripts/inspect-sportmonks-cert.js

# Should show certificate from SportMonks CA
# If shows your proxy CA, TLS interception is happening
```

**Solutions:**

**Option A: Install Proxy CA (Windows)**
```powershell
# Get .cer file from your IT team
.\docs\dev-scripts\install-proxy-ca.ps1 -CertPath 'C:\path\to\proxy-ca.cer'

# Verify:
node scripts/inspect-sportmonks-cert.js
```

**Option B: Allowlist SportMonks Host**
- Ask your network/proxy team to allowlist `api.sportmonks.com`
- This prevents the proxy from re-signing requests to that host
- Restart worker after allowlisting

**Option C: Temporary Workaround (Dev Only)**
```bash
export SPORTSMONKS_INSECURE=true
node src/worker-final.js
```
⚠️ **DO NOT use in production.** Unset after TLS is fixed.

### Problem: Redis Connection Refused

**Diagnosis:**
```bash
# Check Redis is running and accessible:
redis-cli PING

# If fails, check:
redis-cli -u "$REDIS_URL" PING
```

**Solutions:**
- [ ] Ensure Redis server is running
- [ ] Verify `REDIS_URL` is correct (host, port, password)
- [ ] Check firewall allows connection to Redis host
- [ ] Test: `redis-cli -u "redis://default:password@host:6379" PING`

---

## Deployment to Production Platforms

### Heroku / Railway / Render

1. **Set Config Variables** in platform dashboard:
   ```
   TELEGRAM_TOKEN=...
   REDIS_URL=...
   SPORTSMONKS_API=...
   TELEGRAM_WEBHOOK_SECRET=<random-secret>
   ```

2. **Deploy**:
   ```bash
   git push heroku main
   # or: git push railway main
   ```

3. **Start Worker Dyno/Process**:
   ```bash
   heroku ps:scale worker=1
   # or equivalent for your platform
   ```

### Self-Hosted Linux (systemd)

1. **Create service file** (`/etc/systemd/system/betrix-worker.service`):
   ```ini
   [Unit]
   Description=BETRIX Telegram Bot Worker
   After=network.target redis.service
   Wants=redis.service
   
   [Service]
   Type=simple
   User=betrix
   Group=betrix
   WorkingDirectory=/opt/betrix
   EnvironmentFile=/opt/betrix/.env
   ExecStart=/usr/bin/node /opt/betrix/src/worker-final.js
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   SyslogIdentifier=betrix-worker
   
   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and start**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable betrix-worker
   sudo systemctl start betrix-worker
   sudo systemctl status betrix-worker
   ```

3. **Monitor**:
   ```bash
   sudo journalctl -u betrix-worker -f
   sudo systemctl restart betrix-worker  # If needed
   ```

### Docker

1. **Build image**:
   ```bash
   docker build -t betrix-bot:latest .
   ```

2. **Run container**:
   ```bash
   docker run -d \
     --name betrix-worker \
     -e TELEGRAM_TOKEN="$TELEGRAM_TOKEN" \
     -e REDIS_URL="$REDIS_URL" \
     -e SPORTSMONKS_API="$SPORTSMONKS_API" \
     betrix-bot:latest \
     node src/worker-final.js
   ```

3. **Monitor**:
   ```bash
   docker logs -f betrix-worker
   docker stats betrix-worker
   ```

---

## Post-Deployment Tasks

- [ ] **Monitor bot for 24 hours**:
  - Regular `/live` tests
  - Check worker logs for errors
  - Verify Redis heartbeat every 6 hours

- [ ] **Set up alerts**:
  - Slack notification if worker crashes
  - Alert if Redis connection fails
  - Monitor Telegram webhook health

- [ ] **Document deployment**:
  - Note environment variables used
  - Record TLS setup (proxy CA installed, etc.)
  - Keep runbook updated for next deployment

- [ ] **Backup configuration**:
  - Store `.env` in secure location (not git)
  - Document Redis password separately
  - Keep SportMonks API token in password manager

---

## Rollback Plan

If critical issues occur:

```bash
# 1. Stop worker:
kill <worker-pid>
# or: systemctl stop betrix-worker
# or: docker stop betrix-worker

# 2. Revert to previous commit:
git checkout <previous-commit-hash>
npm install

# 3. Restart with previous version:
node src/worker-final.js
```

---

## Support & Escalation

| Issue | Owner | Contact |
|-------|-------|---------|
| Telegram bot not responding | Dev team | Check logs, validate webhook |
| Redis authentication error | DevOps/DBA | Verify credentials, check Redis server |
| TLS certificate errors | Network/Security | Install proxy CA or allowlist host |
| SportMonks API errors | External | Check SportMonks status page |
| Performance degradation | Dev team + DevOps | Monitor worker logs and resource usage |

---

## References

- [QUICKSTART_DEPLOY.md](QUICKSTART_DEPLOY.md) — Fast deployment (15-30 min)
- [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) — Detailed setup guide
- [README.md](README.md) — Architecture and feature overview
- [CHANGELOG.md](CHANGELOG.md) — What changed in this version

---

**Last Updated**: 2025-11-29  
**Next Review**: 2025-12-06  
**Status**: ✅ Ready for Production
