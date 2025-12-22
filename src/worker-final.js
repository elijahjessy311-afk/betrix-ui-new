#!/usr/bin/env node

/**
 * BETRIX Final Production Worker
 * Complete integration of all services and intelligence
 */

// NOTE: Do NOT disable global TLS verification here. Use per-service TLS config
// via `SPORTSMONKS_INSECURE=true` if absolutely required for local testing.

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
// Prefer loading .env.local when present (Render uses .env.local for secrets in this workspace)
const envLocalPath = ".env.local";
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log("[env] loaded .env.local - worker-final.js:18");
} else {
  dotenv.config();
}

import Redis from "ioredis";
import { getRedis, MockRedis } from "./lib/redis-factory.js";
import createRedisAdapter from "./utils/redis-adapter.js";
import { CONFIG, validateConfig } from "./config.js";
import { Logger } from "./utils/logger.js";
import { TelegramService } from "./services/telegram.js";
import { broadcastText } from "./telegram/broadcast.js";
import { UserService } from "./services/user.js";
// API-Football removed from runtime per operator request — prefer SportMonks and Football-Data
import { GeminiService } from "./services/gemini.js";
import { LocalAIService } from "./services/local-ai.js";
import { HuggingFaceService } from "./services/huggingface.js";
import { AzureAIService } from "./services/azure-ai.js";
import { FreeSportsService } from "./services/free-sports.js";
import ClaudeService from "./services/claude.js";
import GroqService from "./services/groq.js";
import { BotHandlers } from "./handlers.js";
import OpenLigaDBService from "./services/openligadb.js";
import RSSAggregator from "./services/rss-aggregator.js";
import FootballDataService from "./services/footballdata.js";
import ScoreBatService from "./services/scorebat-enhanced.js";
import Scrapers from "./services/scrapers.js";
import SportsAggregator from "./services/sports-aggregator.js";
import FlashLiveService from "./services/flashlive-service.js";
import OddsAnalyzer from "./services/odds-analyzer.js";
import { MultiSportAnalyzer } from "./services/multi-sport-analyzer.js";
import { startPrefetchScheduler } from "./tasks/prefetch-scheduler.js";
import RapidApiLogger from "./lib/rapidapi-logger.js";
import { APIBootstrap } from "./tasks/api-bootstrap.js";
// Sportradar integration removed — do not import or start Sportradar prefetch
import CacheService from "./services/cache.js";
import { AdvancedHandler } from "./advanced-handler.js";
import { PremiumService } from "./services/premium.js";
import { AdminDashboard } from "./admin/dashboard.js";
import { AnalyticsService } from "./services/analytics.js";
import { RateLimiter } from "./middleware/rate-limiter.js";
import { ContextManager } from "./middleware/context-manager.js";
import v2Handler from "./handlers/telegram-handler-v2-clean.js";
import { handleOnboardingMessage } from "./handlers/telegram-handler-v2.js";
import completeHandler from "./handlers/handler-complete.js";
// SportMonks integration removed — stub out sportMonksAPI as null
import SportsDataAPI from "./services/sportsdata-api.js";
import ImageProvider from "./services/image-provider.js";
import { registerDataExposureAPI } from "./app_clean.js";
import app from "./app_clean.js";
import { runMediaAiTick } from "./tickers/mediaAiTicker.js";
import { canPostNow, markPosted } from "./lib/liveliness.js";
import { Pool } from "pg";
import { reconcileWithLipana } from "./tasks/reconcile-lipana.js";
import nowPayments from "./payments/nowpayments_v2.js";

// ===== PREMIUM ENHANCEMENT MODULES =====
import premiumUI from "./utils/premium-ui-builder.js";
import advancedAnalysis from "./utils/advanced-match-analysis.js";
import fixturesManager from "./utils/fixtures-manager.js";
import intelligentMenus from "./utils/intelligent-menu-builder.js";
import brandingUtils from "./utils/betrix-branding.js";
import perfUtils from "./utils/performance-optimizer.js";

const logger = new Logger("FinalWorker");

import persona from "./ai/persona.js";
import { cacheSet } from "./lib/redis-cache.js";
import createRag from "./ai/rag.js";

try {
  validateConfig();
  logger.info(
    "✅ Configuration validated (SPORTSMONKS or FOOTBALLDATA keys accepted)",
  );
} catch (err) {
  logger.error("Configuration failed", err);
  process.exit(1);
}

// Warn if TLS verification has been disabled globally — avoid changing it here
try {
  if (String(process.env.NODE_TLS_REJECT_UNAUTHORIZED || '').trim() === '0') {
    logger.warn("NODE_TLS_REJECT_UNAUTHORIZED=0 detected — TLS verification is disabled. Avoid this in production; set ALLOW_INSECURE_TLS=1 only for local testing.");
  }
} catch (e) {}

// ---- SAFE startup test broadcast (temporary) ----
// Prefer sending to configured admin ID to avoid posting to a channel the bot
// isn't a member of. If no admin or broadcast ID is configured, skip the test.
try {
  const adminId =
    process.env.ADMIN_TELEGRAM_ID ||
    (CONFIG && CONFIG.TELEGRAM && CONFIG.TELEGRAM.ADMIN_ID) ||
    null;
  const broadcastEnv =
    process.env.BOT_BROADCAST_CHAT_ID ||
    (CONFIG && CONFIG.TELEGRAM && CONFIG.TELEGRAM.BROADCAST_CHAT_ID) ||
    null;
  const target = adminId || broadcastEnv || null;

  if (target) {
    const msg = adminId
      ? "🚀 BETRIX TEST BROADCAST — Admin delivery check."
      : "🚀 BETRIX TEST BROADCAST — Channel delivery check.";

    // Use broadcastText helper which is async; do not block initialization.
    broadcastText(String(target), msg)
      .then(() => logger.info("Startup test broadcast dispatched", { target }))
      .catch((err) =>
        logger.error(
          "Startup test broadcast error",
          err && err.message ? err.message : String(err),
        ),
      );
  } else {
    logger.info(
      "No ADMIN_TELEGRAM_ID or BOT_BROADCAST_CHAT_ID set — skipping startup test broadcast",
    );
  }
} catch (e) {
  logger.warn(
    "Startup test broadcast encountered an exception",
    e && e.message ? e.message : String(e),
  );
}

// Initialize Redis with a safe fallback to in-memory MockRedis for local dev
let redis;
try {
  // getRedis will return a MockRedis when REDIS_URL is not set. If a REDIS_URL
  // is set but authentication fails (NOAUTH), we'll detect it via ping()
  redis = createRedisAdapter(getRedis());
  try {
    // test connectivity; if this throws (NOAUTH etc.) we fallback
    if (typeof redis.ping === "function") await redis.ping();
    logger.info("✅ Redis connected (factory)");
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes("NOAUTH")) {
      logger.warn(
        "⚠️ Redis authentication failed (NOAUTH). Falling back to in-memory MockRedis for local dev",
      );
    } else {
      logger.warn(
        "⚠️ Redis ping failed, using in-memory MockRedis for local dev",
        msg,
      );
    }
    redis = createRedisAdapter(new MockRedis());
  }
} catch (e) {
  logger.warn(
    "⚠️ Redis initialization failed, using in-memory MockRedis",
    e?.message || String(e),
  );
  redis = createRedisAdapter(new MockRedis());
}

// attach a safe error handler to avoid unhandled errors
if (redis && typeof redis.on === "function") {
  try {
    redis.on("error", (err) => logger.error("Redis error", err));
  } catch (e) {}
}

// ===== STARTUP ENV & SERVICE VALIDATION =====
// Ensure critical environment variables are present in the Render environment
(() => {
  const telegramToken =
    process.env.TELEGRAM_TOKEN ||
    (CONFIG && CONFIG.TELEGRAM && CONFIG.TELEGRAM.TOKEN) ||
    CONFIG.TELEGRAM_TOKEN ||
    CONFIG.TELEGRAM?.BOT_USERNAME ||
    null;
  const redisUrl = process.env.REDIS_URL || CONFIG.REDIS_URL || null;
  // Accept both legacy names and newer Azure OpenAI naming used in Render
  const azureKey =
    process.env.AZURE_AI_KEY ||
    process.env.AZURE_KEY ||
    process.env.AZURE_OPENAI_KEY ||
    process.env.AZURE_OPENAI_KEY ||
    (CONFIG.AZURE && CONFIG.AZURE.KEY) ||
    null;
  const sgoKey =
    process.env.SPORTSGAMEODDS_API_KEY ||
    process.env.SPORTSGAMEODDS_KEY ||
    null;

  // Allow a local developer override to run the worker without all external secrets.
  // Set `ALLOW_LOCAL_RUN=1` in your environment to skip strict startup checks.
  const missing = [];
  if (!telegramToken) missing.push("TELEGRAM_TOKEN");
  if (!redisUrl) missing.push("REDIS_URL");
  if (!azureKey) missing.push("AZURE_AI_KEY or AZURE_KEY");
  if (!sgoKey) missing.push("SPORTSGAMEODDS_API_KEY");

  // If Redis URL is set but we fell back to MockRedis, that's a connectivity/auth issue
  const isMock =
    redis && redis.constructor && redis.constructor.name === "MockRedis";
  if (redisUrl && isMock) {
    logger.error(
      "REDIS_URL provided but failed to connect/authenticate to Redis; MockRedis in use",
    );
    if (String(process.env.ALLOW_LOCAL_RUN) === "1") {
      logger.warn(
        "ALLOW_LOCAL_RUN=1 detected — continuing with MockRedis for local development",
      );
    } else {
      process.exit(1);
    }
  }

  if (missing.length > 0) {
    if (String(process.env.ALLOW_LOCAL_RUN) === "1") {
      logger.warn(
        "ALLOW_LOCAL_RUN=1 detected — skipping missing env var checks (missing: " +
          missing.join(", ") +
          ")",
      );
    } else {
      logger.error(
        "Missing required startup environment variables: " + missing.join(", "),
      );
      // Exit early so Render shows a failed deploy and you can fix env vars
      process.exit(1);
    }
  }

  logger.info(
    "Startup env check: required env vars present (TELEGRAM, AZURE, SPORTSGAMEODDS, REDIS)",
  );
})();

// Initialize Postgres pool (optional) — fall back gracefully if DATABASE_URL not set or connection fails
let pgPool;
try {
  const connStr =
    process.env.DATABASE_URL || (CONFIG && CONFIG.DATABASE_URL) || null;
  if (connStr) {
    pgPool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
    });
    // quick connectivity smoke-test
    await pgPool.query("SELECT 1");
    logger.info("✅ Postgres pool initialized");
  } else {
    logger.warn(
      "⚠️ DATABASE_URL not set — Postgres pool will not be initialized",
    );
    pgPool = null;
  }
} catch (err) {
  logger.warn(
    "⚠️ Postgres pool initialization failed — continuing without DB",
    err?.message || String(err),
  );
  try {
    if (pgPool && typeof pgPool.end === "function") await pgPool.end();
  } catch (e) {}
  pgPool = null;
}

// small sleep helper used in the main loop
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Worker heartbeat: update a small Redis key periodically so the web process can check worker health
setInterval(async () => {
  try {
    await redis.set("worker:heartbeat", Date.now());
    await redis.expire("worker:heartbeat", 30); // keep for 30s
  } catch (err) {
    logger.error("Heartbeat write failed", err);
  }
}, 10 * 1000);

// Sportradar prefetch removed; no-op reserved for backward compatibility

// Initialize all services
const telegram = new TelegramService(
  CONFIG.TELEGRAM_TOKEN,
  CONFIG.TELEGRAM.SAFE_CHUNK,
);
const userService = new UserService(redis);
// Periodic Lipana reconciliation (runs only if Postgres pool is available)
if (pgPool) {
  const minutes = Number(process.env.RECONCILE_INTERVAL_MINUTES || 10);
  const intervalMs = Math.max(1, minutes) * 60 * 1000;
  setInterval(async () => {
    try {
      logger.info("Running scheduled Lipana reconciliation");
      await reconcileWithLipana({
        pool: pgPool,
        telegram,
        redis,
        thresholdMinutes: Number(process.env.RECONCILE_THRESHOLD_MINUTES || 15),
        limit: Number(process.env.RECONCILE_LIMIT || 200),
        adminId:
          process.env.ADMIN_TELEGRAM_ID ||
          (CONFIG && CONFIG.ADMIN_TELEGRAM_ID) ||
          null,
      });
      logger.info("Scheduled Lipana reconciliation complete");
    } catch (err) {
      logger.error(
        "Scheduled Lipana reconciliation failed",
        err?.message || String(err),
      );
    }
  }, intervalMs);
}
// Do not instantiate API-Football service — set to null so handlers fall back to SportMonks/Football-Data
const apiFootball = null;
const gemini = new GeminiService(CONFIG.GEMINI.API_KEY);
const hfModels =
  process.env.HUGGINGFACE_MODELS || process.env.HUGGINGFACE_MODEL || null;
const huggingface = new HuggingFaceService(
  hfModels,
  process.env.HUGGINGFACE_TOKEN,
);
const localAI = new LocalAIService();
// Construct AzureAIService using either legacy env names or the newer AZURE_OPENAI_* names
const azure = new AzureAIService(
  process.env.AZURE_AI_ENDPOINT ||
    process.env.AZURE_ENDPOINT ||
    process.env.AZURE_OPENAI_ENDPOINT ||
    (CONFIG.AZURE && CONFIG.AZURE.ENDPOINT),
  process.env.AZURE_AI_KEY ||
    process.env.AZURE_KEY ||
    process.env.AZURE_OPENAI_KEY ||
    (CONFIG.AZURE && CONFIG.AZURE.KEY),
  process.env.AZURE_AI_DEPLOYMENT ||
    process.env.AZURE_DEPLOYMENT ||
    process.env.AZURE_OPENAI_DEPLOYMENT ||
    (CONFIG.AZURE && CONFIG.AZURE.DEPLOYMENT),
  process.env.AZURE_API_VERSION ||
    process.env.AZURE_OPENAI_API_VERSION ||
    (CONFIG.AZURE && CONFIG.AZURE.API_VERSION) ||
    "2023-05-15",
);
// Create RAG helper instance (non-fatal if embeddings not configured)
let rag = null;
try {
  rag = createRag({ redis, azure, logger });
  logger.info("RAG helper created (indexing available)");
} catch (e) {
  logger.warn("RAG helper not available:", e && e.message ? e.message : e);
  rag = null;
}
// Log Azure configuration presence (do not log secrets)
try {
  if (azure && azure.enabled) {
    logger.info("✅ Azure AI configured", {
      endpoint: azure.endpoint || null,
      deployment: azure.deployment || null,
      apiVersion: azure.apiVersion || azure.apiVersion,
    });
  } else {
    logger.info("ℹ️ Azure AI not configured (no endpoint/key/deployment)");
  }
} catch (e) {
  /* ignore */
}
// Allow forcing Azure first via env var for testing: set FORCE_AZURE=1 or FORCE_AZURE_PROVIDER=1
const FORCE_AZURE =
  String(
    process.env.FORCE_AZURE ||
      process.env.FORCE_AZURE_PROVIDER ||
      process.env.PREFER_AZURE ||
      "",
  ).toLowerCase() === "1" ||
  String(
    process.env.FORCE_AZURE ||
      process.env.FORCE_AZURE_PROVIDER ||
      process.env.PREFER_AZURE ||
      "",
  ).toLowerCase() === "true";
const freeSports = new FreeSportsService(redis);
const cache = new CacheService(redis);
const openLiga = new OpenLigaDBService(undefined, cache, { ttlSeconds: 30 });
const rssAggregator = new RSSAggregator(cache, { ttlSeconds: 60 });
const footballDataService = new FootballDataService();
const scorebatService = new ScoreBatService(
  process.env.SCOREBAT_TOKEN || null,
  cache,
  {
    retries: Number(process.env.SCOREBAT_RETRIES || 3),
    cacheTtlSeconds: Number(process.env.SCOREBAT_CACHE_TTL || 60),
  },
);
const scrapers = new Scrapers(redis);
// Initialize SportsAggregator with enforced provider priority: only SportMonks and Football-Data
const sportsAggregator = new SportsAggregator(redis, {
  scorebat: scorebatService,
  rss: rssAggregator,
  openLiga,
  allowedProviders: ["SPORTSMONKS", "FOOTBALLDATA"],
});
let flashLiveService = null;
try {
  const flashKey = process.env.FLASHLIVE_API_KEY || process.env.FLASHLIVE_KEY || null;
  if (flashKey) flashLiveService = new FlashLiveService(redis, { apiKey: flashKey, host: process.env.FLASHLIVE_HOST });
} catch (e) { logger.warn('FlashLive service init failed', e && e.message ? e.message : String(e)); }
const oddsAnalyzer = new OddsAnalyzer(redis, sportsAggregator, null);
const multiSportAnalyzer = new MultiSportAnalyzer(
  redis,
  sportsAggregator,
  null,
);
const sportMonksAPI = null;
const sportsDataAPI = new SportsDataAPI();

// Claude (Anthropic) - prefer if enabled in config
const claude = new ClaudeService(
  CONFIG.CLAUDE.API_KEY,
  CONFIG.CLAUDE.MODEL,
  CONFIG.CLAUDE.TIMEOUT_MS,
);
// Groq - OpenAI-compatible provider
const groq = new GroqService(
  process.env.GROQ_API_KEY || (CONFIG.GROQ && CONFIG.GROQ.API_KEY),
  process.env.GROQ_MODEL || (CONFIG.GROQ && CONFIG.GROQ.MODEL),
  Number(process.env.GROQ_TIMEOUT_MS || 20000),
  process.env.GROQ_BASE_URL ||
    (CONFIG.GROQ && CONFIG.GROQ.BASE_URL) ||
    "https://api.groq.com",
);

// Composite AI wrapper: try Gemini per-request, fall back to LocalAI on errors.
// create AI wrapper that uses Azure + RAG as the brain
import { createAIWrapper } from "./ai/wrapper.js";

const ai = createAIWrapper({
  azure,
  gemini,
  huggingface,
  localAI,
  claude,
  groq,
  redis,
  logger,
});

// Startup probe: check remote AI providers (Azure, HuggingFace) and disable them
// automatically if they return 401/unauthorized so the worker can fall back
// to other providers (e.g., LocalAI) and remain functional.
async function probeAIProviders() {
  try {
    if (azure && typeof azure.embeddings === "function" && azure.enabled) {
      try {
        await azure.embeddings(["ping"]);
      } catch (e) {
        const msg = String(e?.message || "").toLowerCase();
        if (
          (e && e.status === 401) ||
          msg.includes("invalid subscription key") ||
          msg.includes("access denied")
        ) {
          logger.error(
            "Azure returned 401/unauthorized during startup probe — disabling Azure provider until credentials are fixed.",
          );
          azure.enabled = false;
        } else {
          logger.warn(
            "Azure embeddings probe failed (non-auth):",
            e?.message || String(e),
          );
        }
      }
    }
  } catch (err) {
    logger.warn("Azure probe error", err?.message || String(err));
  }

  try {
    if (huggingface && huggingface.enabled) {
      try {
        await huggingface.chat("ping");
      } catch (e) {
        const msg = String(e?.message || "").toLowerCase();
        if (
          msg.includes("401") ||
          msg.includes("unauthorized") ||
          msg.includes("not found")
        ) {
          logger.error(
            "HuggingFace returned 401/unauthorized during startup probe — disabling HuggingFace provider until credentials or model names are fixed.",
          );
          huggingface.enabled = false;
        } else {
          logger.warn(
            "HuggingFace probe failed (non-auth):",
            e?.message || String(e),
          );
        }
      }
    }
  } catch (err) {
    logger.warn("HuggingFace probe error", err?.message || String(err));
  }

  // Log final provider availability
  try {
    logger.info("AI providers availability after probe", {
      azure:
        azure && typeof azure.enabled !== "undefined" ? azure.enabled : false,
      huggingface:
        huggingface && typeof huggingface.enabled !== "undefined"
          ? huggingface.enabled
          : false,
      gemini:
        gemini && typeof gemini.enabled !== "undefined"
          ? gemini.enabled
          : false,
      localAI:
        localAI && typeof localAI.isHealthy === "function"
          ? localAI.isHealthy()
          : true,
    });
  } catch (e) {
    /**/
  }
}

(async () => {
  await probeAIProviders();
})();

// keep analyzeSport stub if needed
ai.analyzeSport = async function (sport, matchData, question) {
  if (gemini && gemini.enabled) {
    try {
      if (typeof gemini.analyzeSport === "function")
        return await gemini.analyzeSport(sport, matchData, question);
    } catch (err) {
      logger.warn(
        "Gemini.analyzeSport failed, falling back",
        err?.message || String(err),
      );
    }
  }

  if (huggingface && huggingface.isHealthy()) {
    try {
      return await huggingface.analyzeSport(sport, matchData, question);
    } catch (err) {
      logger.warn(
        "HuggingFace.analyzeSport failed, falling back",
        err?.message || String(err),
      );
    }
  }

  return localAI.analyzeSport(sport, matchData, question);
};

ai.isHealthy = function () {
  return (
    (gemini && gemini.enabled) ||
    (huggingface && huggingface.isHealthy()) ||
    (localAI && typeof localAI.isHealthy === "function"
      ? localAI.isHealthy()
      : true)
  );
};
const analytics = new AnalyticsService(redis);
const rateLimiter = new RateLimiter(redis);
const contextManager = new ContextManager(redis);
const basicHandlers = new BotHandlers(
  telegram,
  userService,
  apiFootball,
  ai,
  redis,
  freeSports,
  {
    openLiga,
    rss: rssAggregator,
    scorebat: scorebatService,
    footballData: footballDataService,
    scrapers,
  },
);

// StatPal integration removed: system now uses SPORTSMONKS and FOOTBALLDATA only
let statpalInitSuccess = false;
logger.info(
  "ℹ️ StatPal integration disabled/removed — using SPORTSMONKS and FOOTBALL-DATA only",
);

// ===== API BOOTSTRAP: Validate keys and immediately prefetch data =====
let apiBootstrapSuccess = false;
try {
  const apiBootstrap = new APIBootstrap(sportsAggregator, oddsAnalyzer, redis);
  const bootstrapResult = await apiBootstrap.initialize();
  apiBootstrapSuccess = bootstrapResult.success;

  if (bootstrapResult.success) {
    logger.info("✅ API Bootstrap successful", bootstrapResult.data);
    // Start continuous prefetch after initial success
    apiBootstrap.startContinuousPrefetch(
      Number(process.env.PREFETCH_INTERVAL_SECONDS || 60),
    );
  } else {
    logger.warn("⚠️  API Bootstrap warning", bootstrapResult);
  }
} catch (e) {
  logger.warn("API Bootstrap initialization failed", e?.message || String(e));
}

// Start prefetch scheduler (runs in-worker). Interval controlled by PREFETCH_INTERVAL_SECONDS (default 60s).
try {
  startPrefetchScheduler({
    redis,
    openLiga,
    rss: rssAggregator,
    scorebat: scorebatService,
    footballData: footballDataService,
    sportsAggregator: sportsAggregator,
    flashlive: flashLiveService,
    intervalSeconds: Number(process.env.PREFETCH_INTERVAL_SECONDS || 60),
  });
  logger.info("Prefetch scheduler started", {
    intervalSeconds: Number(process.env.PREFETCH_INTERVAL_SECONDS || 60),
  });
  // Expose RapidAPI env info in startup logs so Render shows if key and max-sports are set
  try {
    console.log(`[rapidapi] rapidapi_key_present=${!!process.env.RAPIDAPI_KEY} RAPIDAPI_ODDS_MAX_SPORTS=${process.env.RAPIDAPI_ODDS_MAX_SPORTS || 'unset'} - worker-final.js:646`);
    // Attempt a quick dump of any per-sport rapidapi cache keys so deploy logs show samples.
    (async () => {
      try {
        if (!process.env.RAPIDAPI_KEY) return;
        // allow the scheduler a moment to run and populate keys
        await sleep(2500);
        const patternOdds = 'rapidapi:odds:sport:*';
        const patternScores = 'rapidapi:scores:sport:*';
        let keysOdds = [];
        let keysScores = [];
        try {
          keysOdds = (await redis.keys(patternOdds)) || [];
        } catch (e) {
          // some Redis providers disallow KEYS in prod, fallback to SCAN if available
          try {
            const stream = redis.scanStream({ match: patternOdds, count: 100 });
            for await (const resultKeys of stream) {
              keysOdds.push(...resultKeys);
              if (keysOdds.length >= 5) break;
            }
          } catch (e2) {}
        }
        try {
          keysScores = (await redis.keys(patternScores)) || [];
        } catch (e) {
          try {
            const stream = redis.scanStream({ match: patternScores, count: 100 });
            for await (const resultKeys of stream) {
              keysScores.push(...resultKeys);
              if (keysScores.length >= 5) break;
            }
          } catch (e2) {}
        }

        const toShow = 5;
        if ((keysOdds && keysOdds.length) || (keysScores && keysScores.length)) {
          console.log('[rapidapisamples] Found rapidapi persport keys (showing up to 5 each) - worker-final.js:683');
          for (let i = 0; i < Math.min(toShow, keysOdds.length); i++) {
            try {
              const k = keysOdds[i];
              const v = await redis.get(k);
              console.log(`[rapidapisamples] ${k} ${String(v).slice(0,800)} - worker-final.js:688`);
            } catch (e) {
              console.log('[rapidapisamples] readerror - worker-final.js:690', e && e.message ? e.message : String(e));
            }
          }
          for (let i = 0; i < Math.min(toShow, keysScores.length); i++) {
            try {
              const k = keysScores[i];
              const v = await redis.get(k);
              console.log(`[rapidapisamples] ${k} ${String(v).slice(0,800)} - worker-final.js:697`);
            } catch (e) {
              console.log('[rapidapisamples] readerror - worker-final.js:699', e && e.message ? e.message : String(e));
            }
          }

          // Minimal safe debug: indicate prefetch scheduler and rapidapi logging are active
          try {
            console.log('[debug] prefetch scheduler active; rapidapi proxy calls will be logged as [rapidapi] entries (keys masked) - worker-final.js:706');
          } catch (e) {}
        } else {
          console.log('[rapidapisamples] no persport rapidapi keys found (scheduler may not have run yet) - worker-final.js:709');
        }
      } catch (e) {
        console.log('[rapidapisamples] dump error - worker-final.js:712', e && e.message ? e.message : String(e));
      }
    })();
  } catch (e) {}
} catch (e) {
  logger.warn("Prefetch scheduler failed to start", e?.message || String(e));
}

// One-off RapidAPI connectivity probe to force visible startup logs in deployment
try {
  (async () => {
    try {
      if (!process.env.RAPIDAPI_KEY) {
        console.log("[rapidapionestep] skipped  RAPIDAPI_KEY not set - worker-final.js:725");
        return;
      }
      const subsPath = path.join(process.cwd(), "src", "rapidapi", "subscriptions.json");
      let subs = [];
      try {
        const raw = fs.readFileSync(subsPath, "utf8");
        subs = JSON.parse(raw);
      } catch (e) {
        /* ignore */
      }
      const candidate = (Array.isArray(subs) ? subs : []).find((s) => s && s.host && s.enabled !== false) || subs[0];
      if (!candidate || !candidate.host) {
        console.log("[rapidapionestep] nosubscriptionfound - worker-final.js:738");
        return;
      }
      let fetcher = null;
      try {
        fetcher = new RapidApiLogger({ apiKey: process.env.RAPIDAPI_KEY });
      } catch (e) {
        console.info('[rapidapi] RapidApiLogger init failed in workeronestep, using minimal fallback - worker-final.js:745', e?.message || String(e));
        fetcher = {
          fetch: async (host, endpoint, opts = {}) => {
            try {
              const url = `https://${host}${endpoint}`;
              const headers = {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
                'X-RapidAPI-Host': host,
                Accept: 'application/json',
              };
              if (String(host || '').toLowerCase().includes('the-odds-api.com')) headers['x-api-key'] = process.env.RAPIDAPI_KEY || '';
              const res = await fetch(url, { method: 'GET', headers }).catch((err) => { throw err; });
              const body = await (res && typeof res.json === 'function' ? res.json().catch(() => null) : null);
              let hdrs = {};
              try { if (res && res.headers && typeof res.headers.entries === 'function') for (const [k,v] of res.headers.entries()) hdrs[k]=v; } catch (e2) {}
              return { httpStatus: res.status, body, headers: hdrs };
            } catch (err) {
              return { httpStatus: null, body: null, error: { message: err && err.message ? err.message : String(err) } };
            }
          }
        };
      }
      const endpoint = (candidate.sampleEndpoints && candidate.sampleEndpoints[0]) || "/";
      try {
        const res = await fetcher.fetch(candidate.host, endpoint, { timeout: 10000 });
        console.log(`[rapidapionestep] host=${candidate.host} endpoint=${endpoint} status=${res && res.httpStatus ? res.httpStatus : 'nostatus'} - worker-final.js:770`);
        try {
          const body = res && res.body ? (typeof res.body === 'string' ? res.body : JSON.stringify(res.body)) : null;
          // Suppress noisy dumps for common 'No game found' responses — those are logged as concise warnings elsewhere
          if (body && /no game found/i.test(String(body))) {
            // do not dump the full body
          } else if (body) {
            console.log(`[rapidapionestepbody] ${String(body).slice(0,1200)} - worker-final.js:777`);
          }
        } catch (e) {}
      } catch (e) {
        console.log("[rapidapionestep] fetcherror - worker-final.js:781", e && e.message ? e.message : String(e));
      }
    } catch (e) {
      console.log("[rapidapionestep] error - worker-final.js:784", e && e.message ? e.message : String(e));
    }
  })();
} catch (e) {
  /* ignore */
}

// Register Data Exposure API endpoints for accessing cached sports data
try {
  registerDataExposureAPI(sportsAggregator);
  logger.info("✅ Data Exposure API registered - access at /api/data/*");
} catch (e) {
  logger.warn("Failed to register Data Exposure API", e?.message || String(e));
}

// Start minimal HTTP server so Render detects an open port and webhooks can be received.
try {
  const PORT = Number(process.env.PORT || process.env.RENDER_PORT || 5000);
  const HOST = process.env.HOST || "0.0.0.0";
  app.listen(PORT, HOST, () => {
    const msg = `HTTP server listening on ${HOST}:${PORT}`;
    // Ensure a plain console log exists for Render's port scanner and for easier debugging
    console.log(msg);
    logger.info(msg);
  });
} catch (e) {
  logger.warn(
    "Failed to start HTTP server for webhooks",
    e?.message || String(e),
  );
}

// Attempt to register Telegram webhook automatically when webhook URL and token are provided.
// This makes deploy logs show webhook registration success/failure.
try {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || null;
  const TELEGRAM_WEBHOOK_URL =
    process.env.TELEGRAM_WEBHOOK_URL || process.env.TELEGRAM_WEBHOOK || null;
  const TELEGRAM_WEBHOOK_SECRET =
    process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || null;

  if (TELEGRAM_TOKEN && TELEGRAM_WEBHOOK_URL) {
    (async () => {
      try {
        const setUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`;
        const body = { url: TELEGRAM_WEBHOOK_URL };
        if (TELEGRAM_WEBHOOK_SECRET)
          body.secret_token = TELEGRAM_WEBHOOK_SECRET;
        // prefer JSON to avoid form encoding complexity
        const resp = await fetch(setUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          timeout: 10000,
        });
        const json = await resp.json().catch(() => null);
        if (json && json.ok) {
          logger.info("✅ Telegram webhook set successfully", {
            url: TELEGRAM_WEBHOOK_URL,
          });
          console.log("Telegram webhook set successfully - worker-final.js:844");
        } else {
          logger.warn("⚠️ Telegram setWebhook returned non-ok", {
            result: json,
          });
        }
      } catch (err) {
        logger.warn(
          "⚠️ Telegram setWebhook failed",
          err?.message || String(err),
        );
      }
    })();
  } else {

// Force a small The Odds API per-sport probe at startup to ensure per-sport
// logs appear in deployment logs (helps ops confirm RapidAPI odds/scores).
try {
  (async () => {
    try {
      if (!process.env.RAPIDAPI_KEY) return;
      const subsPath = path.join(process.cwd(), "src", "rapidapi", "subscriptions.json");
      let subs = [];
      try {
        const raw = fs.readFileSync(subsPath, "utf8");
        subs = JSON.parse(raw);
      } catch (e) {}
      const oddsApi = (Array.isArray(subs) ? subs : []).find((s) => s && s.host && /odds\.p\.rapidapi\.com|odds-api/i.test(s.host + (s.name||'')) );
      if (!oddsApi || !oddsApi.host) {
        // nothing to probe
        return;
      }
      let fetcher = null;
      try {
        fetcher = new RapidApiLogger({ apiKey: process.env.RAPIDAPI_KEY });
      } catch (e) {
        console.info('[rapidapi] RapidApiLogger init failed in workerperfprobe, using minimal fallback - worker-final.js:880', e?.message || String(e));
        fetcher = {
          fetch: async (host, endpoint, opts = {}) => {
            try {
              const url = `https://${host}${endpoint}`;
              const headers = {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
                'X-RapidAPI-Host': host,
                Accept: 'application/json',
              };
              if (String(host || '').toLowerCase().includes('the-odds-api.com')) headers['x-api-key'] = process.env.RAPIDAPI_KEY || '';
              const res = await fetch(url, { method: 'GET', headers }).catch((err) => { throw err; });
              const body = await (res && typeof res.json === 'function' ? res.json().catch(() => null) : null);
              let hdrs = {};
              try { if (res && res.headers && typeof res.headers.entries === 'function') for (const [k,v] of res.headers.entries()) hdrs[k]=v; } catch (e2) {}
              return { httpStatus: res.status, body, headers: hdrs };
            } catch (err) {
              return { httpStatus: null, body: null, error: { message: err && err.message ? err.message : String(err) } };
            }
          }
        };
      }
      // fetch sports list
      try {
        const sportsRes = await fetcher.fetch(oddsApi.host, '/v4/sports/?');
        const sportsList = Array.isArray(sportsRes.body) ? sportsRes.body : (sportsRes.body && sportsRes.body.data && Array.isArray(sportsRes.body.data) ? sportsRes.body.data : []);
        if (Array.isArray(sportsList) && sportsList.length) {
          const limit = Math.min(3, sportsList.length);
          for (let i = 0; i < limit; i++) {
            const s = sportsList[i];
            const sportKey = s && (s.key || s.sport_key || s.id || s.name);
            if (!sportKey) continue;
            try {
              const oddsEndpoint = `/v4/sports/${encodeURIComponent(sportKey)}/odds?regions=us&markets=h2h,spreads&oddsFormat=decimal`;
              const oddsRes = await fetcher.fetch(oddsApi.host, oddsEndpoint, { retries: 3, timeout: 12000, backoffBaseMs: 300 }).catch(() => null);
              const total = Array.isArray(oddsRes && oddsRes.body) ? oddsRes.body.length : (oddsRes && oddsRes.body && oddsRes.body.data && Array.isArray(oddsRes.body.data) ? oddsRes.body.data.length : 0);
              console.log(`[rapidapistartupoddssport] ${sportKey} status=${oddsRes && oddsRes.httpStatus ? oddsRes.httpStatus : 'err'} total=${total} - worker-final.js:916`);
              // If we hit 429 (rate limit) stop further probes and set a cooldown key
              try {
                if (oddsRes && Number(oddsRes.httpStatus) === 429) {
                  const backoffSeconds = Number(process.env.RAPIDAPI_BACKOFF_SECONDS || 300);
                  console.log(`[rapidapi] rate limit detected from Odds API  setting rapidapi:backoff for ${backoffSeconds}s - worker-final.js:921`);
                  try {
                    await redis.set('rapidapi:backoff', Date.now());
                    await redis.expire('rapidapi:backoff', backoffSeconds);
                  } catch (e) {
                    console.log('[rapidapi] failed to write rapidapi:backoff to Redis - worker-final.js:926', e && e.message ? e.message : String(e));
                  }
                  break;
                }
              } catch (e) {
                /* ignore */
              }
            } catch (e) {
              console.log(`[rapidapistartupoddssport] ${sportKey} error ${e && e.message ? e.message : String(e)} - worker-final.js:934`);
            }
            try {
              const scoresEndpoint = `/v4/sports/${encodeURIComponent(sportKey)}/scores/`;
              const scoresRes = await fetcher.fetch(oddsApi.host, scoresEndpoint, { retries: 3, timeout: 12000, backoffBaseMs: 300 }).catch(() => null);
              const totalS = Array.isArray(scoresRes && scoresRes.body) ? scoresRes.body.length : (scoresRes && scoresRes.body && scoresRes.body.data && Array.isArray(scoresRes.body.data) ? scoresRes.body.data.length : 0);
              console.log(`[rapidapistartupscoressport] ${sportKey} status=${scoresRes && scoresRes.httpStatus ? scoresRes.httpStatus : 'err'} total=${totalS} - worker-final.js:940`);
              try {
                if (scoresRes && Number(scoresRes.httpStatus) === 429) {
                  const backoffSeconds = Number(process.env.RAPIDAPI_BACKOFF_SECONDS || 300);
                  console.log(`[rapidapi] rate limit detected from Odds API (scores)  setting rapidapi:backoff for ${backoffSeconds}s - worker-final.js:944`);
                  try {
                    await redis.set('rapidapi:backoff', Date.now());
                    await redis.expire('rapidapi:backoff', backoffSeconds);
                  } catch (e) {
                    console.log('[rapidapi] failed to write rapidapi:backoff to Redis - worker-final.js:949', e && e.message ? e.message : String(e));
                  }
                  break;
                }
              } catch (e) {
                /* ignore */
              }
            } catch (e) {
              console.log(`[rapidapistartupscoressport] ${sportKey} error ${e && e.message ? e.message : String(e)} - worker-final.js:957`);
            }
          }
        }
      } catch (e) {
        console.log('[rapidapistartup] sportslisterror - worker-final.js:962', e && e.message ? e.message : String(e));
      }
    } catch (e) {
      /* ignore */
    }
  })();
} catch (e) {}
    logger.info(
      "ℹ️ Telegram webhook auto-registration skipped (TELEGRAM_TOKEN or TELEGRAM_WEBHOOK_URL missing)",
    );
  }
} catch (e) {
  logger.warn("Telegram webhook registration error", e?.message || String(e));
}

// Subscribe to prefetch events for internal observability and reactive caching
try {
  const sub = new Redis(CONFIG.REDIS_URL);
  sub
    .subscribe("prefetch:updates", "prefetch:error")
    .then(() => logger.info("Subscribed to prefetch pub/sub channels"))
    .catch(() => {});
  sub.on("message", async (channel, message) => {
    let payload = message;
    try {
      payload = JSON.parse(message);
    } catch (e) {
      /* raw */
    }
    logger.info("Prefetch event", { channel, payload });
    // Example reactive action: when openligadb updates, optionally warm specific caches
    try {
      if (
        channel === "prefetch:updates" &&
        payload &&
        payload.type === "openligadb"
      ) {
        // touch a short key indicating last openligadb update
        await redis.set("prefetch:last:openligadb", Date.now());
        await redis.expire("prefetch:last:openligadb", 300);
      }
      // When rapidapi prefetch completes, emit unified aggregated totals for Render logs
      if (channel === "prefetch:updates" && payload && payload.type === "rapidapi") {
        try {
          const { aggregateFixtures } = await import("./lib/fixtures-aggregator.js");
          const agg = await aggregateFixtures(redis).catch(() => null);
          if (agg) {
            // Emit unified per-sport breakdown (one line per sport) for consolidated logs
            try {
              for (const [s, counts] of Object.entries(agg.bySport || {})) {
                logger.info(`[aggregator] ${s} live=${counts.live} upcoming=${counts.upcoming}`);
              }
            } catch (e) {}
            // Emit overall totals and provider summary (compact)
            try {
              const providerList = Object.keys(agg.providers || {}).join(',');
              logger.info(`[aggregator] providers=${providerList} live=${agg.totalLiveMatches} upcoming=${agg.totalUpcomingFixtures}`);
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {
      logger.warn("Failed reactive prefetch action", e?.message || String(e));
    }
  });
} catch (e) {
  logger.warn("Prefetch subscriber failed to start", e?.message || String(e));
}
// If we're running with an in-memory MockRedis, skip creating a separate
// subscriber connection because MockRedis doesn't implement pub/sub.
try {
  const isMock =
    redis && redis.constructor && redis.constructor.name === "MockRedis";
  if (!isMock && CONFIG.REDIS_URL) {
    const sub = new Redis(CONFIG.REDIS_URL);
    sub
      .subscribe("prefetch:updates", "prefetch:error")
      .then(() => logger.info("Subscribed to prefetch pub/sub channels"))
      .catch(() => {});
    sub.on("message", async (channel, message) => {
      let payload = message;
      try {
        payload = JSON.parse(message);
      } catch (e) {
        /* raw */
      }
      logger.info("Prefetch event", { channel, payload });
      try {
        if (
          channel === "prefetch:updates" &&
          payload &&
          payload.type === "openligadb"
        ) {
          await redis.set("prefetch:last:openligadb", Date.now());
          await redis.expire("prefetch:last:openligadb", 300);
        }
        if (channel === "prefetch:updates" && payload && payload.type === "rapidapi") {
          try {
            const { aggregateFixtures } = await import("./lib/fixtures-aggregator.js");
            const agg = await aggregateFixtures(redis).catch(() => null);
            if (agg) {
              try {
                for (const [s, counts] of Object.entries(agg.bySport || {})) {
                  logger.info(`[aggregator] ${s} live=${counts.live} upcoming=${counts.upcoming}`);
                }
              } catch (e) {}
              try {
                const providerList = Object.keys(agg.providers || {}).join(',');
                logger.info(`[aggregator] providers=${providerList} live=${agg.totalLiveMatches} upcoming=${agg.totalUpcomingFixtures}`);
              } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {
        logger.warn("Failed reactive prefetch action", e?.message || String(e));
      }
    });
  } else {
    logger.info(
      "ℹ️ Pub/sub disabled: using in-memory MockRedis for local development",
    );
  }
} catch (e) {
  logger.warn("Prefetch subscriber failed to start", e?.message || String(e));
}
// Inject Redis into v2 handler for telemetry wiring (no-op for MockRedis)
if (typeof v2Handler.setTelemetryRedis === "function") {
  try {
    v2Handler.setTelemetryRedis(redis);
    logger.info("✅ Telemetry Redis injected into v2Handler");
  } catch (e) {}
}

// ===== SCHEDULE: Media AI Ticker =====
try {
  const intervalSeconds = Number(
    process.env.MEDIA_AI_INTERVAL_SECONDS ||
      process.env.MEDIA_AI_TICK_INTERVAL_SECONDS ||
      180,
  );
  if (intervalSeconds > 0) {
    setInterval(
      async () => {
        try {
          // Respect liveliness policy stored in Redis
          const ok = await canPostNow();
          if (!ok) return;

          await runMediaAiTick();
          // markPosted is best-effort; if runMediaAiTick posted, mark it
          try {
            await markPosted();
          } catch (e) {
            /* ignore */
          }
        } catch (e) {
          logger.warn(
            "MediaAiTicker scheduled run failed",
            e?.message || String(e),
          );
        }
      },
      Math.max(1000, intervalSeconds * 1000),
    );
    logger.info("MediaAiTicker scheduled", { intervalSeconds });
  } else {
    logger.info("MediaAiTicker scheduling disabled (intervalSeconds <= 0)");
  }
} catch (e) {
  logger.warn("Failed to schedule MediaAiTicker", e?.message || String(e));
}

// ===== INITIALIZE PERFORMANCE OPTIMIZER =====
// perfUtils is a class (default export). Create an instance to access methods.
const perfInstance = new perfUtils(redis);
const perfOptimizer = {
  instance: perfInstance,
  prefetcher: perfInstance.prefetchData.bind(perfInstance),
  rateLimiterFactory: perfInstance.createRateLimiter.bind(perfInstance),
  getMetrics: perfInstance.getMetrics.bind(perfInstance),
};
logger.info("✅ Performance Optimizer instance created (PerformanceOptimizer)");

// Wrap sportsAggregator methods with caching
if (sportsAggregator) {
  const originalGetLiveMatches = sportsAggregator.getLiveMatches;
  sportsAggregator.getLiveMatches = async function (leagueId) {
    try {
      const cacheKey = `cache:live_matches:${leagueId || "all"}`;
      // Use PerformanceOptimizer.smartCache to fetch-or-read cached value
      const result = await perfInstance.smartCache(
        cacheKey,
        async () => {
          return await originalGetLiveMatches.call(this, leagueId);
        },
        120,
      );
      return result;
    } catch (e) {
      logger.warn("Cached getLiveMatches failed, falling back", e.message);
      return originalGetLiveMatches.call(this, leagueId);
    }
  };

  const originalGetLeagues = sportsAggregator.getLeagues;
  sportsAggregator.getLeagues = async function (sport) {
    try {
      const cacheKey = `cache:leagues:${sport || "all"}`;
      const result = await perfInstance.smartCache(
        cacheKey,
        async () => {
          return await originalGetLeagues.call(this, sport);
        },
        600,
      );
      return result;
    } catch (e) {
      logger.warn("Cached getLeagues failed, falling back", e.message);
      return originalGetLeagues.call(this, sport);
    }
  };

  logger.info("✅ Performance caching enabled on sportsAggregator");
}

// Setup callback telemetry alerts (sends admin message if truncation threshold exceeded)
setInterval(async () => {
  try {
    const truncCount = await redis.get(
      "betrix:telemetry:callback_truncated_outgoing",
    );
    const repOdds = await redis.get(
      "betrix:telemetry:callback_repetition_odds",
    );
    if ((Number(truncCount) || 0) > 10 || (Number(repOdds) || 0) > 5) {
      const adminId =
        CONFIG.TELEGRAM && CONFIG.TELEGRAM.ADMIN_ID
          ? Number(CONFIG.TELEGRAM.ADMIN_ID)
          : null;
      if (adminId && telegram) {
        const msg = `⚠️ *Callback Telemetry Alert*\n\nTruncated outgoing: ${truncCount || 0}\nRepetition (odds): ${repOdds || 0}\n\nCheck samples: betrix:telemetry:callback_truncated_samples`;
        await telegram
          .sendMessage(adminId, msg, { parse_mode: "Markdown" })
          .catch(() => {});
      }
      await redis.set("betrix:telemetry:callback_truncated_outgoing", "0");
      await redis.set("betrix:telemetry:callback_repetition_odds", "0");
    }
  } catch (e) {
    logger.warn(
      "Callback telemetry alert check failed",
      e?.message || String(e),
    );
  }
}, 60 * 1000);

const advancedHandler = new AdvancedHandler(
  basicHandlers,
  redis,
  telegram,
  userService,
  ai,
);
const premiumService = new PremiumService(redis, ai);
const adminDashboard = new AdminDashboard(redis, telegram, analytics);

// Start automation schedulers (media ticker, odds, fixtures, live alerts)
try {
  // dynamic import of `node-cron` and automation modules
  const cronMod = await import("node-cron");
  const cron = cronMod && cronMod.default ? cronMod.default : cronMod;
  // dynamic import of automation modules
  const { startMediaTickerScheduler } =
    await import("./automation/mediaTicker.js");
  const { startOddsTickerScheduler } =
    await import("./automation/oddsTicker.js");
  const { startFixturesTickerScheduler } =
    await import("./automation/fixturesTicker.js");
  const { startLiveAlertsScheduler } =
    await import("./automation/liveAlerts.js");

  function startSchedulers() {
    try {
      startMediaTickerScheduler(cron, sportsAggregator);
    } catch (e) {
      logger.warn(
        "MediaTicker failed to start",
        e && e.message ? e.message : e,
      );
    }
    try {
      startOddsTickerScheduler(cron, sportsAggregator);
    } catch (e) {
      logger.warn("OddsTicker failed to start", e && e.message ? e.message : e);
    }
    try {
      startFixturesTickerScheduler(cron, sportsAggregator);
    } catch (e) {
      logger.warn(
        "FixturesTicker failed to start",
        e && e.message ? e.message : e,
      );
    }
    try {
      startLiveAlertsScheduler(cron, sportsAggregator);
    } catch (e) {
      logger.warn("LiveAlerts failed to start", e && e.message ? e.message : e);
    }
  }

  startSchedulers();
  logger.info("✅ Automation schedulers start attempted");
  // ---- Startup test broadcast (temporary) ----
  try {
    const testChat =
      process.env.BOT_BROADCAST_CHAT_ID ||
      (CONFIG && CONFIG.TELEGRAM && CONFIG.TELEGRAM.BROADCAST_CHAT_ID) ||
      null;
    if (testChat) {
      (async () => {
        try {
          // Attempt to fetch a representative image and send as photo where possible
          const caption =
            "🚀 BETRIX TEST BROADCAST — If you see this, the channel wiring works.";
          const imageUrl = await ImageProvider.findImage({
            q: "betrix test broadcast",
          });
          if (imageUrl) {
            await telegram.sendPhoto(Number(testChat), imageUrl, caption, {
              disable_notification: true,
            });
          } else {
            // Fallback to text-only broadcast
            await telegram.sendMessage(Number(testChat), caption);
          }
          logger.info("Startup test broadcast sent", { chat: testChat });
        } catch (err) {
          logger.error(
            "Startup test broadcast failed",
            err && err.message ? err.message : String(err),
          );
        }
      })();
    } else {
      logger.info(
        "No BOT_BROADCAST_CHAT_ID set — skipping startup test broadcast",
      );
    }
  } catch (e) {
    logger.warn(
      "Startup test broadcast encountered an error",
      e && e.message ? e.message : String(e),
    );
  }
} catch (e) {
  logger.warn(
    "Automation schedulers failed to initialize",
    e && e.message ? e.message : e,
  );
}

logger.info("🚀 BETRIX Final Worker - All Services Initialized");

let running = true; // flag used to gracefully stop the main loop on SIGTERM/SIGINT

async function main() {
  logger.info("🌟 BETRIX Worker started - waiting for Telegram updates");

  // Write Redis startup markers (global + deploy-specific) so boot can be verified programmatically.
  (async () => {
    try {
      const deployId =
        process.env.RENDER_DEPLOY_ID ||
        process.env.COMMIT_SHA ||
        process.env.RENDER_SERVICE_ID ||
        null;
      const ttlSeconds = 60 * 60 * 24;
      const globalKey = `rapidapi:startup:registered`;
      await cacheSet(globalKey, "registered", ttlSeconds);
      console.log(`[startup] Redis marker ${globalKey}=registered - worker-final.js:1341`);

      if (deployId) {
        try {
          const key = `rapidapi:startup:${deployId}`;
          await cacheSet(key, "registered", ttlSeconds);
          console.log(`[startup] Redis marker ${key}=registered - worker-final.js:1347`);
        } catch (innerErr) {
          console.warn(
            '[startup] failed to write deploy-specific redis startup marker (worker)',
            innerErr && innerErr.message ? innerErr.message : innerErr,
          );
        }
      }
    } catch (e) {
      console.warn('[startup] failed to write worker redis startup marker - worker-final.js:1356', e && e.message ? e.message : e);
    }
  })();

  // On startup, move any items left in processing back to the main queue so they are retried
  try {
    let moved = 0;
    while (true) {
      const item = await redis.rpoplpush(
        "telegram:processing",
        "telegram:updates",
      );
      if (!item) break;
      moved += 1;
      // avoid busy looping
      if (moved % 100 === 0) await sleep(10);
    }
    if (moved > 0)
      logger.info(
        `Requeued ${moved} items from telegram:processing to telegram:updates`,
      );
  } catch (err) {
    logger.warn(
      "Failed to requeue processing list on startup",
      err?.message || String(err),
    );
  }

  while (running) {
    try {
      // BRPOPLPUSH blocks until an item is available or timeout (5s)
      const raw = await redis.brpoplpush(
        "telegram:updates",
        "telegram:processing",
        5,
      );
      if (!raw) {
        // timeout expired, loop again to check running flag
        continue;
      }

      // mark which AI is active for observability (set before processing)
      const preferred =
        gemini && gemini.enabled
          ? "gemini"
          : azure && azure.isHealthy()
            ? "azure"
            : huggingface && huggingface.isHealthy()
              ? "huggingface"
              : "local";
      await redis.set("ai:active", preferred);
      await redis.expire("ai:active", 30);

      const data = JSON.parse(raw);
      await handleUpdate(data);

      // remove the processed item from processing list
      await redis.lrem("telegram:processing", 1, raw).catch(() => {});
    } catch (err) {
      logger.error("Worker error", err?.message || String(err));
      // small backoff on error
      await sleep(1000);
    }
  }

  logger.info("Main loop exited (running=false)");
}

async function handleUpdate(update) {
  try {
    if (update.message) {
      const { chat, from, text } = update.message;
      const userId = from.id;
      const chatId = chat.id;

      // Admin-guard: intercept takeover/hacked claims to avoid social-engineering the bot
      try {
        const takeoverRegex =
          /\b(hack|hacked|i have control|i hacked|i own you|i have access|i control you|someone hacked|i broke you)\b/i;
        if (text && takeoverRegex.test(String(text))) {
          logger.warn("Admin-claim detected in user message", {
            userId,
            chatId,
            text: String(text).slice(0, 200),
          });
          // record claim for manual review
          try {
            await redis.lpush(
              "admin:claims",
              JSON.stringify({
                userId,
                chatId,
                text: String(text),
                ts: Date.now(),
              }),
            );
          } catch (e) {
            logger.warn(
              "Failed to record admin claim",
              e && e.message ? e.message : e,
            );
          }

          // Notify user with a safe, non-committal message
          await telegram.sendMessage(
            chatId,
            "I can't confirm takeover or control claims. If you are an administrator, please authenticate via the admin interface. This claim has been logged for review.",
          );

          // Notify configured admin(s)
          try {
            const adminId =
              process.env.ADMIN_TELEGRAM_ID ||
              (CONFIG && CONFIG.TELEGRAM && CONFIG.TELEGRAM.ADMIN_ID) ||
              null;
            if (adminId) {
              const adminMsg = `⚠️ *Takeover claim logged*\n\nUser: ${userId}\nChat: ${chatId}\nTime: ${new Date().toISOString()}\nMessage: ${String(text).slice(0, 400)}`;
              await telegram
                .sendMessage(adminId, adminMsg, { parse_mode: "Markdown" })
                .catch(() => {});
            }
          } catch (e) {
            logger.warn(
              "Failed to notify admin of claim",
              e && e.message ? e.message : e,
            );
          }

          // Do not process further
          return;
        }
      } catch (e) {
        logger.warn("Admin-guard check failed", e && e.message ? e.message : e);
      }

      // Check suspension
      if (await adminDashboard.isUserSuspended(userId)) {
        return await telegram.sendMessage(
          chatId,
          "⛔ Your account has been suspended.",
        );
      }

      // Track engagement
      await analytics.trackEngagement(userId, "message");
      await contextManager.recordMessage(userId, text, "user");

      // Optional: auto-index incoming user messages into RAG (non-blocking)
      try {
        const enableIndex =
          String(process.env.ENABLE_AUTO_INDEXING || "0") === "1";
        if (
          enableIndex &&
          rag &&
          typeof rag.indexDocument === "function" &&
          text &&
          String(text).trim().length > 0
        ) {
          // fire-and-forget indexing so it doesn't block user response
          (async () => {
            try {
              const id = `telegram-manual-${userId}-${Date.now()}`;
              await rag.indexDocument(id, String(text), {
                userId,
                chatId,
                source: "telegram",
              });
              logger.info("Auto-indexed message into RAG", { id });
            } catch (ie) {
              logger.warn(
                "Auto-indexing failed",
                ie && ie.message ? ie.message : ie,
              );
            }
          })();
        }
      } catch (e) {
        logger.warn(
          "Auto-index decision failed",
          e && e.message ? e.message : e,
        );
      }

      // Rate limit check
      const tier =
        (await userService.getUser(userId))?.role === "vvip"
          ? "premium"
          : "default";
      if (!(await advancedHandler.checkRateLimit(chatId, userId, tier))) {
        return;
      }

      // Check structured onboarding flow first (new flow)
      // Skip onboarding dispatch for slash commands so commands show menus.
      // If user explicitly issues a command that indicates they want to restart
      // or leave onboarding (e.g. /start, /cancel, /menu, /signup) clear any
      // existing onboarding state so subsequent plain messages are not
      // interpreted as onboarding replies.
      try {
        if (text && String(text).startsWith("/")) {
          const cmd = String(text).split(/\s+/)[0].trim().toLowerCase();
          // Do not clear onboarding on /start so onboarding can continue unless
          // the user explicitly requests cancellation or restarts signup.
          if (["/cancel", "/menu", "/signup"].includes(cmd)) {
            try {
              await redis.del(`user:${userId}:onboarding`);
              logger.info("Cleared onboarding state due to command", { cmd, userId });
            } catch (e) {
              logger.debug("Failed to clear onboarding state", e?.message || String(e));
            }
          }
        } else {
          const onboardRaw = await redis.get(`user:${userId}:onboarding`);
          if (onboardRaw) {
            // If user is already ACTIVE, treat onboarding as stale and clear it.
            // Use centralized helper so behavior is consistent across handlers.
            try {
              const cleaned =
                userService && typeof userService.ensureNoOnboarding === "function"
                  ? await userService.ensureNoOnboarding(userId).catch(() => false)
                  : false;
              if (!cleaned) {
                const payload = await handleOnboardingMessage(
                  text,
                  chatId,
                  userId,
                  redis,
                  { telegram, userService, analytics },
                );
                if (payload) {
                  // payload may be an array of actions or a single action
                  const actions = Array.isArray(payload) ? payload : [payload];
                  for (const act of actions) {
                    try {
                      if (!act || !act.method) continue;
                      if (act.method === "sendMessage") {
                        await telegram
                          .sendMessage(act.chat_id || chatId, act.text || "", {
                            reply_markup: act.reply_markup,
                            parse_mode: act.parse_mode,
                          })
                          .catch(() => {});
                      } else if (act.method === "editMessageText") {
                        await telegram
                          .editMessageText(
                            act.chat_id || chatId,
                            act.message_id || null,
                            act.text || "",
                            {
                              reply_markup: act.reply_markup,
                              parse_mode: act.parse_mode,
                            },
                          )
                          .catch(() => {});
                      } else if (act.method === "answerCallbackQuery") {
                        await telegram
                          .answerCallback(
                            act.callback_query_id || act.callbackId,
                            act.text || "",
                            { show_alert: act.show_alert },
                          )
                          .catch(() => {});
                      }
                    } catch (errAct) {
                      logger.warn(
                        "Applying onboarding action failed",
                        errAct && errAct.message ? errAct.message : errAct,
                      );
                    }
                  }
                  return;
                }
              }
            } catch (e) {
              logger.warn("Onboarding dispatch failed", e?.message || String(e));
            }
          }
        }
      } catch (e) {
        logger.warn("Onboarding dispatch failed", e?.message || String(e));
      }

      // Check legacy signup flow
      const signupState = await redis.get(`signup:${userId}:state`);
      if (signupState) {
        return await handleSignupFlow(chatId, userId, text, signupState);
      }

      // Parse and route
      const { cmd, args } = parseCommand(text);

      if (cmd.startsWith("/")) {
        await handleCommand(chatId, userId, cmd, args, text);
      } else {
        // Natural language - use composite AI (Gemini -> HuggingFace -> LocalAI)
        // Build a compact context object: minimal user info + recent messages
        const fullUser = (await userService.getUser(userId)) || {};
        // Ensure context is trimmed to model prompt budget before fetching recent messages
        try {
          await contextManager.trimContextToTokenBudget(
            userId,
            CONFIG.GEMINI.MAX_PROMPT_TOKENS || 1500,
          );
        } catch (e) {
          logger.warn("Context trim failed", e?.message || String(e));
        }
        const recent = await contextManager.getContext(userId).catch(() => []);
        const recentTexts = recent
          .slice(-6)
          .map((m) => `${m.sender}: ${m.message}`);
        const compactContext = {
          id: userId,
          name: fullUser.name || null,
          role: fullUser.role || null,
          favoriteLeagues: fullUser.favoriteLeagues || fullUser.leagues || null,
          preferredLanguage:
            fullUser.preferredLanguage || fullUser.language || "en",
          recentMessages: recentTexts,
          // Ensure Azure (and other providers that honor system messages) receive the BETRIX persona
          system: persona.getSystemPrompt({
            includeContext: {
              id: userId,
              role: fullUser.role || null,
              name: fullUser.name || null,
            },
          }),
        };

        const response = await ai.chat(text, compactContext);
        await contextManager.recordMessage(userId, response, "bot");
        await telegram.sendMessage(chatId, response);
      }
    }

    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackId = callbackQuery.id;
      const userId = callbackQuery.from?.id;
      const chatId = callbackQuery.message?.chat?.id;

      // Avoid answering callback queries that are already too old (Telegram rejects if >60s)
      try {
        const cbMsgDate =
          callbackQuery.message &&
          (callbackQuery.message.date || callbackQuery.message.edit_date)
            ? Number(
                callbackQuery.message.date || callbackQuery.message.edit_date,
              )
            : null;
        const ageSec = cbMsgDate ? Date.now() / 1000 - cbMsgDate : 0;
        if (ageSec && ageSec > 55) {
          logger.info(
            "Skipping initial answerCallback: callback appears too old",
            { ageSec },
          );
        } else {
          await telegram.answerCallback(callbackId, "Processing...");
        }
      } catch (e) {
        // If initial answer fails (rare), continue without blocking the callback handling
        logger.warn(
          "Initial answerCallback failed, continuing dispatch",
          e && e.message ? e.message : e,
        );
      }

      try {
        const services = {
          openLiga,
          footballData: footballDataService,
          rss: rssAggregator,
          scrapers,
          sportsAggregator,
          oddsAnalyzer,
          multiSportAnalyzer,
          cache,
          sportsData: sportsDataAPI,
          ai,
          nowPayments,
        };
        const res = await completeHandler.handleCallbackQuery(
          callbackQuery,
          redis,
          services,
        );
        // Log a concise summary of the handler return value to aid debugging
        try {
          const summarize = (v) => {
            try {
              if (v === null || v === undefined) return String(v);
              if (Array.isArray(v)) return `array(${v.length})`;
              if (typeof v === "object")
                return `object(keys:${Object.keys(v).length})`;
              return String(v).slice(0, 200);
            } catch (e) {
              return "unserializable";
            }
          };
          logger.info("Callback handler returned", {
            callback_data: callbackQuery.data,
            summary: summarize(res),
          });
        } catch (e) {
          logger.debug(
            "Failed to summarize callback handler return",
            e && e.message ? e.message : e,
          );
        }
        if (!res) {
          logger.info(
            "Callback handler returned no actions; nothing to dispatch",
            { callback_data: callbackQuery.data },
          );
          return;
        }

        // Normalize to array for uniform processing
        const actions = Array.isArray(res) ? res : [res];

        for (const action of actions) {
          try {
            if (!action || typeof action !== "object") continue;

            const method = (action.method || "").toString();

            // Edit existing message
            if (
              method === "editMessageText" ||
              method === "edit" ||
              action.edit
            ) {
              const messageId =
                action.message_id || callbackQuery.message?.message_id;
              const text = action.text || "";
              const reply_markup = action.reply_markup || null;
              // Pass parse_mode through to editMessage options so handlers
              // that specify HTML vs Markdown are respected.
              await telegram.editMessage(
                chatId,
                messageId,
                text,
                reply_markup,
                { parse_mode: action.parse_mode || "Markdown" },
              );
              logger.info("Dispatched editMessageText", { chatId, messageId });
              continue;
            }

            // Answer callback query (quick popup)
            if (
              method === "answerCallback" ||
              method === "answerCallbackQuery" ||
              action.answer
            ) {
              try {
                await telegram.answerCallback(
                  callbackId,
                  action.text || "",
                  !!action.show_alert,
                );
                logger.info("Dispatched answerCallback", { callbackId });
              } catch (e) {
                const msg = (e && (e.message || String(e))) || "";
                // If Telegram rejects because the query is too old, fallback to sending a message to chat
                if (
                  msg.includes("query is too old") ||
                  msg.includes("too old") ||
                  msg.includes("Query is too old")
                ) {
                  logger.info(
                    "Callback query too old; falling back to sendMessage",
                    { callbackId },
                  );
                  const target = action.chat_id || chatId;
                  try {
                    await telegram.sendMessage(target, action.text || "", {
                      parse_mode: action.parse_mode || "HTML",
                    });
                  } catch (e2) {
                    logger.warn(
                      "Fallback sendMessage failed",
                      e2 && e2.message ? e2.message : e2,
                    );
                  }
                } else {
                  throw e;
                }
              }
              continue;
            }

            // Send a new message to chat or specific chat_id
            if (method === "sendMessage" || action.chat_id || action.text) {
              const target = action.chat_id || chatId;
              const text = action.text || "";
              const opts = {
                reply_markup: action.reply_markup,
                parse_mode: action.parse_mode || "HTML",
              };
              logger.debug("Callback dispatch sendMessage opts", {
                target,
                has_reply_markup: !!opts.reply_markup,
                parse_mode: opts.parse_mode,
              });
              await telegram.sendMessage(target, text, opts);
              logger.info("Dispatched sendMessage", { target });
              continue;
            }

            // Unknown action: log for debugging
            logger.warn("Unknown callback action returned by v2 handler", {
              action,
            });
          } catch (errAction) {
            const errMsg =
              errAction && (errAction.message || String(errAction));
            const benignPatterns = [
              "message is not modified",
              "message to edit not found",
              "message not found",
              "chat not found",
              "message can't be edited",
              "message cannot be edited",
              "Bad Request: message to edit not found",
              "Bad Request: message is not modified",
            ];

            const matched =
              typeof errMsg === "string" &&
              benignPatterns.some((p) => errMsg.includes(p));
            if (matched) {
              const messageId =
                (action &&
                  (action.message_id || callbackQuery.message?.message_id)) ||
                null;
              logger.info(
                "Benign Telegram API response while dispatching callback action",
                { chatId, messageId, reason: errMsg },
              );
            } else {
              logger.error("Error dispatching callback action", errMsg);
            }
          }
        }
      } catch (err) {
        const errMsg = err && (err.message || String(err));
        const benignPatterns = [
          "message is not modified",
          "message to edit not found",
          "message not found",
          "chat not found",
          "message can't be edited",
          "message cannot be edited",
          "Bad Request: message to edit not found",
          "Bad Request: message is not modified",
        ];
        const matched =
          typeof errMsg === "string" &&
          benignPatterns.some((p) => errMsg.includes(p));
        if (matched) {
          logger.info(
            "Callback handling: benign Telegram API response (non-fatal)",
            { reason: errMsg },
          );
        } else {
          logger.error("Callback handling failed", err);
        }
      }
    }
  } catch (err) {
    logger.error("Update error", err);
  }
}

function parseCommand(text) {
  const normalized = String(text).trim().toLowerCase();
  const parts = normalized.split(/\s+/);
  const cmd = parts[0].replace(/@[\w_]+$/, "");
  const args = parts.slice(1);
  return { cmd, args };
}

async function handleCommand(chatId, userId, cmd, args, fullText) {
  try {
    const user = (await userService.getUser(userId)) || {};
    const isAdmin = userId === parseInt(CONFIG.TELEGRAM.ADMIN_ID);
    const isVVIP = userService.isVVIP(user);

    // Track command
    const start = Date.now();

    // Basic commands - routed through complete handler for full menu system
    const sharedServices = {
      openLiga,
      footballData: footballDataService,
      rss: rssAggregator,
      scrapers,
      sportsAggregator,
      oddsAnalyzer,
      multiSportAnalyzer,
      cache,
      sportsData: sportsDataAPI,
      redis,
      ai,
      nowPayments,
    };
    const basicCommands = {
      "/start": async () => {
        try {
          const result = await completeHandler.handleStart(
            chatId,
            sharedServices,
          );
          await telegram.sendMessage(chatId, result.text, {
            reply_markup: result.reply_markup,
            parse_mode: result.parse_mode || "Markdown",
          });
        } catch (e) {
          logger.warn("/start handler error", e?.message);
          await telegram.sendMessage(chatId, "❌ Error loading menu");
        }
      },
      "/menu": async () => {
        try {
          const result = await completeHandler.handleMenu(
            chatId,
            sharedServices,
          );
          await telegram.sendMessage(chatId, result.text, {
            reply_markup: result.reply_markup,
            parse_mode: result.parse_mode || "Markdown",
          });
        } catch (e) {
          logger.warn("/menu handler error", e?.message);
          await telegram.sendMessage(chatId, "❌ Error loading menu");
        }
      },
      "/live": async () => {
        try {
          const result = await completeHandler.handleLive(
            chatId,
            null,
            sharedServices,
          );
          await telegram.sendMessage(chatId, result.text, {
            reply_markup: result.reply_markup,
            parse_mode: result.parse_mode || "Markdown",
          });
        } catch (e) {
          logger.warn("/live handler error", e?.message);
          await telegram.sendMessage(chatId, "⚽ Error loading live games");
        }
      },
      "/help": async () => {
        try {
          const result = await completeHandler.handleMenu(
            chatId,
            sharedServices,
          );
          if (result && result.text) {
            await telegram.sendMessage(chatId, result.text, {
              reply_markup: result.reply_markup,
              parse_mode: result.parse_mode || "Markdown",
            });
          } else {
            await basicHandlers.help(chatId);
          }
        } catch (e) {
          logger.warn("/help handler error", e?.message);
          await basicHandlers.help(chatId);
        }
      },
      "/about": () => basicHandlers.about(chatId),
      "/live": async () => {
        // route /live to the complete handler (same as above)
        try {
          const result = await completeHandler.handleLive(
            chatId,
            null,
            sharedServices,
          );
          await telegram.sendMessage(chatId, result.text, {
            reply_markup: result.reply_markup,
            parse_mode: result.parse_mode || "Markdown",
          });
        } catch (e) {
          logger.warn("/live handler (duplicate) error", e?.message);
        }
      },
      "/news": () => basicHandlers.news(chatId),
      "/highlights": () => basicHandlers.highlights(chatId),
      "/standings": async () => {
        const services = {
          openLiga,
          footballData: footballDataService,
          rss: rssAggregator,
          scrapers,
          sportsAggregator,
          oddsAnalyzer,
          multiSportAnalyzer,
          cache,
          sportsData: sportsDataAPI,
          ai,
        };
        const text =
          "/standings " + (args && args.length ? args.join(" ") : "");
        const msg = await v2Handler.handleCommand(
          text,
          chatId,
          userId,
          redis,
          services,
        );
        if (msg && msg.chat_id) {
          await telegram.sendMessage(chatId, msg.text || "", {
            reply_markup: msg.reply_markup,
            parse_mode: msg.parse_mode || "Markdown",
          });
        }
      },
      "/league": () => basicHandlers.league(chatId, args.join(" ")),
      "/predict": () => basicHandlers.predict(chatId, args.join(" ")),
      "/odds": async () => {
        const services = {
          openLiga,
          footballData: footballDataService,
          rss: rssAggregator,
          scrapers,
          sportsAggregator,
          oddsAnalyzer,
          multiSportAnalyzer,
          cache,
          sportsData: sportsDataAPI,
          ai,
        };
        const text = "/odds " + (args && args.length ? args.join(" ") : "");
        const msg = await v2Handler.handleCommand(
          text,
          chatId,
          userId,
          redis,
          services,
        );
        if (msg && msg.chat_id) {
          await telegram.sendMessage(chatId, msg.text || "", {
            reply_markup: msg.reply_markup,
            parse_mode: msg.parse_mode || "Markdown",
          });
        }
      },
      "/tips": () => basicHandlers.tips(chatId),
      "/pricing": async () => {
        const services = {
          openLiga,
          footballData: footballDataService,
          rss: rssAggregator,
          scrapers,
          sportsAggregator,
          oddsAnalyzer,
          multiSportAnalyzer,
          cache,
          sportMonks: sportMonksAPI,
          sportsData: sportsDataAPI,
          ai,
        };
        const msg = await v2Handler.handleCommand(
          "/pricing",
          chatId,
          userId,
          redis,
          services,
        );
        if (msg && msg.chat_id) {
          await telegram.sendMessage(chatId, msg.text || "", {
            reply_markup: msg.reply_markup,
            parse_mode: msg.parse_mode || "Markdown",
          });
        } else {
          await basicHandlers.pricing(chatId);
        }
      },
      "/status": () => basicHandlers.status(chatId, userId),
      "/refer": () => basicHandlers.refer(chatId, userId),
      "/leaderboard": () => basicHandlers.leaderboard(chatId),
      "/signup": async () => {
        const services = {
          openLiga,
          footballData: footballDataService,
          rss: rssAggregator,
          scrapers,
          sportsAggregator,
          oddsAnalyzer,
          multiSportAnalyzer,
          cache,
          sportMonks: sportMonksAPI,
          sportsData: sportsDataAPI,
          ai,
        };
        const msg = await v2Handler.handleCommand(
          "/signup",
          chatId,
          userId,
          redis,
          services,
        );
        if (msg && msg.chat_id) {
          await telegram.sendMessage(chatId, msg.text || "", {
            reply_markup: msg.reply_markup,
            parse_mode: msg.parse_mode || "Markdown",
          });
        }
      },
      "/analyze": () => basicHandlers.analyze(chatId, args.join(" ")),
    };

    // Advanced commands
    const advancedCommands = {
      "/stats": () => advancedHandler.handleStats(chatId, userId),
      "/predict": () =>
        advancedHandler.handlePredictAdvanced(chatId, userId, args.join(" ")),
      "/insights": () => advancedHandler.handleInsights(chatId, userId),
      "/compete": () => advancedHandler.handleCompete(chatId, userId),
    };

    // Premium commands
    const premiumCommands = {
      "/dossier": () =>
        premiumService
          .generateMatchDossier({ match: args.join(" ") })
          .then((d) =>
            telegram.sendMessage(chatId, `📋 <b>Match Dossier</b>\n\n${d}`),
          ),
      "/coach": async () => {
        const stats = await analytics.getUserStats(userId);
        const advice = await premiumService.getCoachAdvice(stats);
        return telegram.sendMessage(chatId, `🏆 <b>Coaching</b>\n\n${advice}`);
      },
      "/trends": () =>
        premiumService
          .analyzeSeasonalTrends(args[0] || "premier league")
          .then((t) =>
            telegram.sendMessage(chatId, `📊 <b>Seasonal Trends</b>\n\n${t}`),
          ),
      "/premium": () => basicHandlers.pricing(chatId),
    };

    // Admin commands
    const adminCommands = {
      "/admin_health": () => adminDashboard.sendHealthReport(chatId),
      "/admin_broadcast": () =>
        adminDashboard
          .broadcastMessage(args.join(" "))
          .then((sent) =>
            telegram.sendMessage(chatId, `📢 Broadcast sent to ${sent} users`),
          ),
      "/admin_users": async () => {
        const stats = await adminDashboard.getUserStats();
        return telegram.sendMessage(
          chatId,
          `👥 Total: ${stats.total}, Active: ${stats.active}, Paid: ${stats.paid}`,
        );
      },
      "/admin_suspend": async () => {
        const result = await adminDashboard.suspendUser(
          parseInt(args[0]),
          args.slice(1).join(" "),
        );
        return telegram.sendMessage(
          chatId,
          result ? "✅ User suspended" : "❌ Failed",
        );
      },
      "/admin_revenue": async () => {
        const rev = await adminDashboard.getRevenueMetrics();
        return telegram.sendMessage(
          chatId,
          `💰 Total: $${rev.total}, Today: $${rev.today}, Month: $${rev.month}`,
        );
      },
    };

    // Route to handler
    if (basicCommands[cmd]) {
      await basicCommands[cmd]();
    } else if (advancedCommands[cmd] && user?.signupComplete) {
      await advancedCommands[cmd]();
    } else if (premiumCommands[cmd] && isVVIP) {
      await premiumCommands[cmd]();
    } else if (adminCommands[cmd] && isAdmin) {
      await adminCommands[cmd]();
    } else {
      // Unknown - use Gemini
      await basicHandlers.chat(chatId, userId, fullText);
    }

    // Track command
    const duration = Date.now() - start;
    await analytics.trackCommand(cmd, userId, duration);
  } catch (err) {
    logger.error(`Command ${cmd} failed`, err);
    await telegram.sendMessage(
      chatId,
      "❌ Error processing command. Try /menu",
    );
  }
}

async function handleCallback(chatId, userId, data) {
  const [action, ...params] = data.split(":");
  try {
    const callbacks = {
      "CMD:live": () => basicHandlers.live(chatId, userId),
      "CMD:standings": () => basicHandlers.standings(chatId),
      "CMD:tips": () => basicHandlers.tips(chatId),
      "CMD:pricing": () => basicHandlers.pricing(chatId),
      "CMD:subscribe": () => basicHandlers.pricing(chatId),
      "CMD:signup": () => basicHandlers.signup(chatId, userId),
    };

    if (callbacks[data]) await callbacks[data]();
  } catch (err) {
    logger.error(`Callback ${data} failed`, err);
  }
}

async function handleSignupFlow(chatId, userId, text, state) {
  try {
    if (state === "name") {
      await userService.saveUser(userId, { name: text });
      await redis.set(`signup:${userId}:state`, "country", "EX", 300);
      return await telegram.sendMessage(
        chatId,
        `Nice to meet you, ${text}! 👋\n\nWhich country are you from?`,
      );
    }

    if (state === "country") {
      const user = await userService.saveUser(userId, { country: text });
      await userService.getOrCreateReferralCode(userId);
      await userService.saveUser(userId, { signupComplete: true });
      await redis.del(`signup:${userId}:state`);
      await analytics.trackEngagement(userId, "signup");

      const welcome =
        `✅ Welcome to BETRIX, ${user.name}!\n\n` +
        `You're all set. Here's what's next:\n\n` +
        `💬 /menu - Explore all features\n` +
        `💵 /pricing - View our plans\n` +
        `👥 /refer - Earn rewards\n\n` +
        `💡 Or just chat with me naturally!`;

      return await telegram.sendMessage(chatId, welcome);
    }
  } catch (err) {
    logger.error("Signup error", err);
    await telegram.sendMessage(chatId, "Signup error. Try /signup again.");
  }
}

// Graceful shutdown
// Graceful shutdown helper used for SIGINT and SIGTERM
let mainPromise = null;
async function shutdown(signal) {
  try {
    logger.info(`${signal} received, shutting down gracefully...`);
    // flip flag to stop accepting new work
    running = false;

    // wait a short while for the main loop to finish current job
    if (mainPromise) {
      await Promise.race([mainPromise, sleep(5000)]);
    }

    logger.info("Closing Redis connection...");
    await redis.quit();
    logger.info("Shutdown complete, exiting");
    process.exit(0);
  } catch (err) {
    logger.error("Error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", reason);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", err);
  process.exit(1);
});

main().catch((err) => {
  logger.error("Fatal", err);
  process.exit(1);
});
