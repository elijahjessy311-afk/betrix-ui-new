#!/usr/bin/env bash
# scripts/monitor.sh
# Usage: ./scripts/monitor.sh <BOT_TOKEN> [REDIS_HOST] [REDIS_PORT] [QUEUE_KEY]
BOT_TOKEN="$1"
REDIS_HOST="${2:-127.0.0.1}"
REDIS_PORT="${3:-6379}"
QUEUE_KEY="${4:-queue:telegram:updates}"
INTERVAL="${5:-60}"

if [ -z "$BOT_TOKEN" ]; then
  echo "Usage: $0 <BOT_TOKEN> [REDIS_HOST] [REDIS_PORT] [QUEUE_KEY] [INTERVAL]"
  exit 1
fi

while true; do
  curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq '.result.pending_update_count' 2>/dev/null || echo "getWebhookInfo failed"
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN "$QUEUE_KEY" || echo "redis LLEN failed"
  else
    echo "redis-cli not found; skipping Redis check"
  fi
  sleep "$INTERVAL"
done
