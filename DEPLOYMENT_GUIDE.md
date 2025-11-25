# 🚀 BETRIX Production Deployment Guide

## Prerequisites

- PostgreSQL database
- Redis instance
- Telegram bot (from @BotFather)
- Gemini API key
- Twilio account (for SMS OTP)
- M-Pesa merchant account
- Node.js 20+

## Environment Setup

1. **Create `.env` from template:**
```bash
cp .env.example .env
```

2. **Fill in all variables:**
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/betrix
REDIS_URL=redis://host:6379

# Telegram
TELEGRAM_TOKEN=your_bot_token
ADMIN_TELEGRAM_ID=your_id

# Gemini AI
GEMINI_API_KEY=your_key

# Twilio (OTP)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# M-Pesa
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_TILL=606215
MPESA_CALLBACK_URL=https://your-domain.com/webhook/mpesa

# PayPal (optional)
PAYPAL_CLIENT_ID=your_id
PAYPAL_CLIENT_SECRET=your_secret
```

## Deployment Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Telegram Webhook
```bash
curl -X POST \
  https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://your-domain.com/webhook/telegram"}'
```

### Step 3: Start the Bot
```bash
bash start.sh
```

This will:
- Connect to PostgreSQL
- Initialize Redis
- Start Express on port 5000
- Listen for Telegram webhooks
- Process M-Pesa callbacks
- Start background job queue

### Step 4: Test
```bash
# Health check
curl http://localhost:5000/health

# Send /start to bot in Telegram
```

## Production Deployment Options

### Option 1: Replit (Easiest)
1. Connect GitHub repo
2. Set all secrets in Replit Secrets pane
3. Click "Run" - uses `start.sh`

### Option 2: Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY src src
CMD ["bash", "start.sh"]
```

### Option 3: Traditional Server
```bash
# SSH into server
npm install
pm2 start src/worker-db.js --name betrix
```

## Monitoring

```bash
# Check logs (Replit)
tail -f /tmp/logs/BETRIX*.log

# Check with PM2
pm2 logs betrix

# Health endpoint
curl http://localhost:5000/health
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot not responding | Check TELEGRAM_TOKEN, verify webhook |
| Payment fails | Check M-Pesa credentials, callback URL |
| Phone OTP fails | Check TWILIO_* credentials |
| Database error | Verify DATABASE_URL, check PostgreSQL |
| Queue issues | Check REDIS_URL, verify Redis running |

## Security Checklist

- ✅ Use HTTPS in production
- ✅ Store secrets in environment
- ✅ Enable firewall
- ✅ Regular backups
- ✅ Monitor logs
- ✅ Rotate secrets monthly
- ✅ Rate limiting enabled
- ✅ Input validation enabled

## Performance Tips

- Database: Indexes on all key fields
- Redis: TTL on temp data
- Queues: Batch processing
- API: Caching enabled
- Rate limit: 100 req/15min

## Support

Check these files for help:
- `PRODUCTION_BUILD_COMPLETE.md` - Features list
- `GAPS_ANALYSIS.md` - Architecture details
- `CHECKLIST.md` - Completeness verification

---

**Status: 🚀 Ready to Deploy**
