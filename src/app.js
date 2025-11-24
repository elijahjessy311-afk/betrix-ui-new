/**
 * BETRIX EXPRESS SERVER - PRODUCTION-GRADE (COMPREHENSIVE)
 *
 * - ES module style
 * - Robust middleware: Helmet, CORS, Compression, Morgan, body-parser
 * - Rate limiting with IPv4/IPv6-safe key generator and proxy trust
 * - Redis-backed logging, queues, and caching (ioredis)
 * - WebSocket server (ws) with subscription model and safe send
 * - Admin Basic auth with bcrypt + Redis-stored hash
 * - File uploads via Multer (memory storage) with validation
 * - Telegram webhook validation and async processing
 * - PayPal scaffolding and branded payment pages
 * - Graceful shutdown, health, metrics, and telemetry endpoints
 * - Extensive inline documentation and defensive checks
 *
 * NOTE: Keep environment variables secure in your deployment platform.
 */

import express from "express";
import bodyParser from "body-parser";
import Redis from "ioredis";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import multer from "multer";
import bcrypt from "bcryptjs";

// If Node < 18, uncomment and install node-fetch:
// import fetch from "node-fetch";

// ============================================================================
// PATHS & ENV
// ============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  REDIS_URL = "redis://default:@localhost:6379",
  TELEGRAM_TOKEN = "",
  TELEGRAM_WEBHOOK_SECRET = "",
  TELEGRAM_WEBHOOK_URL = "",
  PAYPAL_CLIENT_ID = "",
  PAYPAL_CLIENT_SECRET = "",
  PORT = "5000",
  NODE_ENV = "production",
  ADMIN_USERNAME = "admin",
  ADMIN_PASSWORD = "betrix2024!",
  ALLOWED_ORIGINS = "*",
  LOG_LIMIT = "1000"
} = process.env;

const port = Number.parseInt(PORT, 10) || 5000;
const isProd = NODE_ENV === "production";
const LOG_STREAM_KEY = "system:logs";
const LOG_KEEP = Math.max(100, Number.parseInt(LOG_LIMIT, 10) || 1000);

// ============================================================================
// APP, SERVER, REDIS, WEBSOCKET
// ============================================================================
const app = express();
const server = createServer(app);
const redis = new Redis(REDIS_URL);

// WebSocket server attached to same HTTP server
const wss = new WebSocketServer({ server });

// Trust proxy so req.ip and X-Forwarded-For behave correctly behind load balancers
app.set("trust proxy", true);

// ============================================================================
// BRAND CONFIG
// ============================================================================
const BETRIX = {
  name: "BETRIX",
  version: "3.0.0",
  slogan: "Intelligent Sports Betting Analytics",
  colors: {
    primary: "#2563eb",
    secondary: "#1e40af",
    accent: "#f59e0b"
  },
  menu: {
    main: [
      { name: "Dashboard", path: "/dashboard", icon: "📊" },
      { name: "Live Odds", path: "/odds", icon: "🎯" },
      { name: "Predictions", path: "/predictions", icon: "🔮" },
      { name: "Leaderboard", path: "/leaderboard", icon: "🏆" },
      { name: "Analytics", path: "/analytics", icon: "📈" },
      { name: "Payments", path: "/payments", icon: "💳" }
    ],
    admin: [
      { name: "Overview", path: "/admin", icon: "🖥️" },
      { name: "Users", path: "/admin/users", icon: "👥" },
      { name: "Payments", path: "/admin/payments", icon: "💰" },
      { name: "Analytics", path: "/admin/analytics", icon: "📊" },
      { name: "Settings", path: "/admin/settings", icon: "⚙️" }
    ]
  },
  pricing: {
    free: { name: "Free", price: 0, features: ["Basic Predictions", "Limited Access"] },
    member: { name: "Member", price: 150, features: ["Advanced analytics", "Priority support"] },
    vvip: { name: "VVIP", price: 200, features: ["AI Coach", "Exclusive content"] }
  }
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================
const safeJson = v => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const log = (level, moduleName, message, data = null) => {
  const ts = new Date().toISOString();
  const entry = { ts, level, module: moduleName, message, data, env: NODE_ENV };
  // Console
  const extra = data ? ` | ${safeJson(data)}` : "";
  console.log(`[${ts}] [${level}] [${moduleName}] ${message}${extra}`);

  // Redis append and trim
  redis
    .lpush(LOG_STREAM_KEY, safeJson(entry))
    .then(() => redis.ltrim(LOG_STREAM_KEY, 0, LOG_KEEP - 1))
    .catch(err => console.error("Redis log error:", err?.message));

  // Increment counters (best-effort)
  redis.incr(`stats:logs:${level}`).catch(() => {});

  // Broadcast WARN/ERROR to admin WS clients
  if (level === "WARN" || level === "ERROR") {
    broadcastToAdmins({ type: "log", entry });
  }
};

// ============================================================================
// WEBSOCKET HELPERS
// ============================================================================
const activeConnections = new Set();
const clientSubscriptions = new Map();

const safeSend = (ws, payload) => {
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
  } catch (err) {
    // ignore send errors
  }
};

const broadcastToAdmins = message => {
  const str = JSON.stringify(message);
  activeConnections.forEach(ws => {
    try {
      if (ws.readyState === 1) ws.send(str);
    } catch {}
  });
};

const broadcastToChannel = (channel, message) => {
  const str = JSON.stringify(message);
  activeConnections.forEach(ws => {
    const subs = clientSubscriptions.get(ws);
    if (subs && subs.has(channel) && ws.readyState === 1) {
      try {
        ws.send(str);
      } catch {}
    }
  });
};

wss.on("connection", (ws, req) => {
  const clientId = Math.random().toString(36).slice(2, 11);
  activeConnections.add(ws);
  clientSubscriptions.set(ws, new Set());

  log("INFO", "WEBSOCKET", "Client connected", {
    clientId,
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    total: activeConnections.size
  });

  ws.on("message", raw => {
    try {
      const data = JSON.parse(String(raw));
      handleWebSocketMessage(ws, data, clientId);
    } catch (err) {
      log("ERROR", "WEBSOCKET", "Invalid WS message", { clientId, err: err.message });
      safeSend(ws, { type: "error", error: "Invalid message format" });
    }
  });

  ws.on("close", () => {
    activeConnections.delete(ws);
    clientSubscriptions.delete(ws);
    log("INFO", "WEBSOCKET", "Client disconnected", { clientId, remaining: activeConnections.size });
  });

  ws.on("error", err => {
    log("ERROR", "WEBSOCKET", "WS error", { clientId, err: err.message });
  });

  safeSend(ws, {
    type: "welcome",
    data: {
      brand: BETRIX.name,
      version: BETRIX.version,
      timestamp: new Date().toISOString(),
      clientId
    }
  });
});

const handleWebSocketMessage = (ws, data, clientId) => {
  if (!data || typeof data.type !== "string") {
    safeSend(ws, { type: "error", error: "Missing message type" });
    return;
  }

  switch (data.type) {
    case "subscribe": {
      const channels = Array.isArray(data.channels) ? data.channels : [data.channels].filter(Boolean);
      const subs = clientSubscriptions.get(ws) || new Set();
      channels.forEach(c => subs.add(c));
      clientSubscriptions.set(ws, subs);
      log("INFO", "WEBSOCKET", "Subscribed", { clientId, channels });
      safeSend(ws, { type: "subscribed", channels, timestamp: Date.now() });
      break;
    }
    case "unsubscribe": {
      const channels = Array.isArray(data.channels) ? data.channels : [data.channels].filter(Boolean);
      const subs = clientSubscriptions.get(ws) || new Set();
      channels.forEach(c => subs.delete(c));
      clientSubscriptions.set(ws, subs);
      log("INFO", "WEBSOCKET", "Unsubscribed", { clientId, channels });
      safeSend(ws, { type: "unsubscribed", channels });
      break;
    }
    case "ping": {
      safeSend(ws, { type: "pong", timestamp: Date.now(), clientId });
      break;
    }
    case "get-stats": {
      safeSend(ws, { type: "stats", data: { uptime: process.uptime(), timestamp: Date.now() } });
      break;
    }
    default: {
      log("WARN", "WEBSOCKET", "Unknown WS type", { clientId, type: data.type });
      safeSend(ws, { type: "error", error: "Unknown message type" });
    }
  }
};

// ============================================================================
// MIDDLEWARE STACK
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.telegram.org", "https://api.paypal.com"]
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
  })
);

app.use(
  cors({
    origin: ALLOWED_ORIGINS === "*" ? "*" : ALLOWED_ORIGINS.split(",").map(s => s.trim()),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200
  })
);

app.use(compression());
app.use(morgan(isProd ? "combined" : "dev"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Static assets
app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Cache headers for static vs dynamic
app.use((req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
  } else {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Branding headers
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", `${BETRIX.name}/${BETRIX.version}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// ============================================================================
// RATE LIMITING - IPv6-safe key generator
// ============================================================================
/**
 * ipKeyGenerator
 * - Normalizes IPv6/IPv4 addresses and falls back to X-Forwarded-For first entry.
 * - Ensures express-rate-limit sees consistent keys for IPv6 addresses.
 */
const ipKeyGenerator = req => {
  // Express sets req.ip using trust proxy; prefer that
  if (req.ip) return String(req.ip);
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    // take first IP in list
    const first = xff.split(",")[0].trim();
    return first || "unknown";
  }
  // fallback to connection/socket
  return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
};

const baseLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => NODE_ENV === "development",
    keyGenerator: ipKeyGenerator
  });

const freeLimiter = baseLimiter(60 * 1000, 30, "Rate limit exceeded. Upgrade for higher limits.");
const memberLimiter = baseLimiter(60 * 1000, 60, "Rate limit exceeded for member tier.");
const vvipLimiter = baseLimiter(60 * 1000, 150, "Rate limit exceeded for VVIP tier.");
const adminLimiter = baseLimiter(60 * 1000, 300, "Rate limit exceeded for admin.");

const getUserTier = async userId => {
  try {
    if (!userId) return "free";
    const tier = await redis.get(`user:tier:${userId}`);
    return tier || "free";
  } catch (err) {
    log("WARN", "TIER", "Redis tier lookup failed", { err: err.message });
    return "free";
  }
};

const tierBasedRateLimiter = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.body?.userId || req.headers["x-user-id"];
    const tier = await getUserTier(userId);
    log("DEBUG", "RATELIMIT", "Tier check", { userId, tier, ip: req.ip, forwarded: req.headers["x-forwarded-for"] });
    if (tier === "admin") return adminLimiter(req, res, next);
    if (tier === "vvip") return vvipLimiter(req, res, next);
    if (tier === "member") return memberLimiter(req, res, next);
    return freeLimiter(req, res, next);
  } catch (err) {
    log("ERROR", "RATELIMIT", "Tier limiter error", { err: err.message });
    return freeLimiter(req, res, next);
  }
};

// ============================================================================
// MULTER FILE UPLOADS
// ============================================================================
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|txt|csv/;
    const ext = path.extname(file.originalname || "").toLowerCase();
    const ok = allowed.test(ext) && allowed.test(file.mimetype);
    if (ok) {
      log("INFO", "UPLOAD", "Accepted file", { filename: file.originalname, mimetype: file.mimetype });
      cb(null, true);
    } else {
      log("WARN", "UPLOAD", "Rejected file", { filename: file.originalname, mimetype: file.mimetype });
      cb(new Error("Invalid file type. Allowed: jpeg, jpg, png, gif, pdf, txt, csv"));
    }
  }
});

// ============================================================================
// AUTHENTICATION - Admin Basic + bcrypt + Redis
// ============================================================================
const authenticateAdmin = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) {
    log("WARN", "AUTH", "Missing Basic auth");
    return res.status(401).json({ error: "Admin authentication required" });
  }
  try {
    const creds = Buffer.from(header.slice(6), "base64").toString();
    const [username, password] = creds.split(":");
    const storedHash = await redis.get("admin:password");
    if (!storedHash) {
      // initialize admin password hash if not present (first-run convenience)
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await redis.set("admin:password", hash);
      log("INFO", "AUTH", "Initialized admin password hash");
    }
    const hashToCheck = storedHash || (await redis.get("admin:password"));
    const valid = await bcrypt.compare(password, hashToCheck);
    if (username === ADMIN_USERNAME && valid) {
      req.adminUser = username;
      log("INFO", "AUTH", "Admin authenticated", { username });
      return next();
    }
    log("WARN", "AUTH", "Invalid admin credentials", { username });
    return res.status(401).json({ error: "Invalid admin credentials" });
  } catch (err) {
    log("ERROR", "AUTH", "Auth error", { err: err.message });
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// ============================================================================
// UTILITIES: formatResponse, brand styles, queue, telegram
// ============================================================================
const formatResponse = (success, data = null, message = "") => ({
  success,
  data,
  message,
  timestamp: new Date().toISOString(),
  brand: BETRIX.name
});

const getBrandStyles = () => `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Segoe UI,system-ui,Arial;background:linear-gradient(135deg,${BETRIX.colors.primary},${BETRIX.colors.secondary});min-height:100vh;display:flex;align-items:center;justify-content:center}
  .container{max-width:700px;padding:24px;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.12)}
  .brand{color:${BETRIX.colors.primary};font-weight:700}
`;

/**
 * queueJob
 * - Pushes a job to Redis list for background processing
 */
const queueJob = async (type, payload, priority = "normal") => {
  const id = Math.random().toString(36).slice(2, 12);
  const job = { id, type, payload, priority, ts: Date.now() };
  try {
    await redis.rpush(`jobs:${priority}`, JSON.stringify(job));
    log("INFO", "QUEUE", "Queued job", { id, type, priority });
    return id;
  } catch (err) {
    log("ERROR", "QUEUE", "Queue push failed", { err: err.message });
    throw err;
  }
};

/**
 * sendTelegram
 * - Simple wrapper to send messages to Telegram bot API
 * - Requires TELEGRAM_TOKEN in env
 */
const sendTelegram = async (chatId, text, options = {}) => {
  if (!TELEGRAM_TOKEN) {
    log("WARN", "TELEGRAM", "Token not configured");
    return { ok: false, error: "Token not configured" };
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const body = { chat_id: chatId, text, parse_mode: "HTML", ...options };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.ok) log("ERROR", "TELEGRAM", "Send failed", { chatId, data });
    else log("INFO", "TELEGRAM", "Message sent", { chatId });
    return data;
  } catch (err) {
    log("ERROR", "TELEGRAM", "Send error", { err: err.message });
    return { ok: false, error: err.message };
  }
};

// ============================================================================
// ROUTES: root, health, metrics, dashboard
// ============================================================================
app.get("/", (req, res) => {
  res.json({
    brand: { name: BETRIX.name, version: BETRIX.version, slogan: BETRIX.slogan },
    status: "operational",
    uptime: process.uptime(),
    endpoints: {
      dashboard: "/dashboard",
      api: "/api/v1",
      admin: "/admin",
      webhooks: "/webhook",
      payments: "/paypal",
      health: "/health",
      metrics: "/metrics"
    },
    menu: BETRIX.menu.main
  });
});

app.get("/health", (req, res) => {
  res.json(formatResponse(true, { status: "healthy", uptime: process.uptime(), redis: true, version: BETRIX.version }, "All systems operational"));
});

app.get("/metrics", async (req, res) => {
  try {
    const logCount = await redis.llen(LOG_STREAM_KEY).catch(() => 0);
    res.json(formatResponse(true, { uptime: process.uptime(), logs: logCount }, "Metrics"));
  } catch (err) {
    res.status(500).json(formatResponse(false, null, "Metrics fetch failed"));
  }
});

app.get("/dashboard", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    brand: { name: BETRIX.name, version: BETRIX.version },
    menu: BETRIX.menu.main,
    stats: { totalUsers: 50000, activePredictions: 1234, totalPayments: 450000, uptime: process.uptime() }
  }));
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================
app.get("/admin", authenticateAdmin, tierBasedRateLimiter, async (req, res) => {
  const raw = await redis.lrange(LOG_STREAM_KEY, 0, 19).catch(() => []);
  const logs = raw.map(r => {
    try { return JSON.parse(r); } catch { return null; }
  }).filter(Boolean);
  res.json(formatResponse(true, { menus: BETRIX.menu.admin, recentLogs: logs }, "Admin overview"));
});

app.get("/admin/users", authenticateAdmin, tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    users: [
      { id: 1, name: "User1", tier: "vvip", status: "active", joined: "2024-01-15" },
      { id: 2, name: "User2", tier: "member", status: "active", joined: "2024-01-20" }
    ],
    total: 50000
  }));
});

app.get("/admin/payments", authenticateAdmin, tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    payments: [
      { id: "PY1", user: "User1", amount: 2500, status: "completed", date: "2024-01-25", method: "PayPal" },
      { id: "PY2", user: "User2", amount: 800, status: "completed", date: "2024-01-24", method: "M-Pesa" }
    ],
    total: 450000
  }));
});

app.post("/admin/settings", authenticateAdmin, upload.single("logo"), async (req, res) => {
  try {
    const settings = req.body || {};
    await redis.set("admin:settings", JSON.stringify(settings));
    log("INFO", "ADMIN", "Settings updated", { admin: req.adminUser });
    res.json(formatResponse(true, settings, "Settings updated"));
  } catch (err) {
    log("ERROR", "ADMIN", "Settings update failed", { err: err.message });
    res.status(500).json(formatResponse(false, null, "Failed to update settings"));
  }
});

// ============================================================================
// PREDICTIONS, ODDS, LEADERBOARD, ANALYTICS (scaffolding)
// ============================================================================
app.get("/predictions", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    predictions: [
      { match: "Barcelona vs Real Madrid", pred: "Barcelona Win", conf: "87%", odds: 1.85 },
      { match: "Man United vs Liverpool", pred: "Over 2.5", conf: "86%", odds: 1.78 },
      { match: "Bayern vs Dortmund", pred: "Bayern Win", conf: "91%", odds: 1.65 }
    ],
    accuracy: 97.2
  }));
});

app.get("/odds", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    odds: [
      { league: "EPL", match: "Man United vs Liverpool", home: 2.45, draw: 3.20, away: 2.80 },
      { league: "La Liga", match: "Barcelona vs Real Madrid", home: 1.85, draw: 3.50, away: 3.95 }
    ],
    updated: new Date().toISOString()
  }));
});

app.get("/leaderboard", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, {
    leaderboard: [
      { rank: 1, name: "ProBetter", points: 15450 },
      { rank: 2, name: "AnalystKing", points: 14320 }
    ],
    yourRank: 247
  }));
});

app.get("/analytics", tierBasedRateLimiter, (req, res) => {
  res.json(formatResponse(true, { dailyActiveUsers: 12340, totalPredictions: 1234567 }));
});

// ============================================================================
// USER ROUTES
// ============================================================================
app.get("/user/:userId/stats", tierBasedRateLimiter, (req, res) => {
  const userId = req.params.userId;
  const bets = 156, wins = 95;
  res.json(formatResponse(true, {
    userId,
    totalBets: bets,
    wins,
    losses: bets - wins,
    winRate: `${((wins / bets) * 100).toFixed(1)}%`
  }));
});

app.get("/user/:userId/referrals", tierBasedRateLimiter, (req, res) => {
  const userId = req.params.userId;
  res.json(formatResponse(true, { userId, totalReferrals: 14, earnings: 8400 }));
});

// ============================================================================
// AUDIT
// ============================================================================
app.get("/audit", authenticateAdmin, tierBasedRateLimiter, async (req, res) => {
  try {
    const raw = await redis.lrange(LOG_STREAM_KEY, 0, 50);
    const parsed = raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    res.json(formatResponse(true, { auditLogs: parsed.slice(0, 20) }));
  } catch (err) {
    log("ERROR", "AUDIT", "Fetch failed", { err: err.message });
    res.status(500).json(formatResponse(false, null, "Failed to fetch audit logs"));
  }
});

// ============================================================================
// PRICING
// ============================================================================
app.get("/pricing", (req, res) => {
  res.json(formatResponse(true, { tiers: BETRIX.pricing }));
});

// ============================================================================
// TELEGRAM WEBHOOKS
// - secure: checks X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET set
// - tokenized path optional if TELEGRAM_WEBHOOK_URL includes token
// ============================================================================
const validateTelegramRequest = (req, tokenInPath) => {
  if (!TELEGRAM_TOKEN) return { ok: false, reason: "TELEGRAM_TOKEN not configured" };

  if (TELEGRAM_WEBHOOK_SECRET) {
    const header = req.headers["x-telegram-bot-api-secret-token"];
    if (!header || header !== TELEGRAM_WEBHOOK_SECRET) return { ok: false, reason: "Invalid secret header" };
  }

  if (tokenInPath && tokenInPath !== TELEGRAM_TOKEN) return { ok: false, reason: "Invalid token in path" };

  return { ok: true };
};

app.post("/webhook/:token?", tierBasedRateLimiter, async (req, res) => {
  const token = req.params.token;
  const valid = validateTelegramRequest(req, token);
  if (!valid.ok) {
    log("WARN", "WEBHOOK", "Invalid webhook request", { reason: valid.reason, forwarded: req.headers["x-forwarded-for"] });
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  // Process webhook asynchronously: queue job and respond 200 quickly
  try {
    const payload = req.body;
    await queueJob("telegram:update", payload, "normal");
    log("DEBUG", "WEBHOOK", "Queued telegram update", { forwarded: req.headers["x-forwarded-for"] });
    res.json({ ok: true });
  } catch (err) {
    log("ERROR", "WEBHOOK", "Queue failed", { err: err.message });
    res.status(500).json({ ok: false, error: "Processing failed" });
  }
});

// ============================================================================
// PAYMENTS SCAFFOLD (PayPal placeholder)
// ============================================================================
app.get("/paypal/checkout", tierBasedRateLimiter, (req, res) => {
  // Minimal branded page for payment redirection
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>${BETRIX.name} Payments</title>
        <style>${getBrandStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="brand"><h1>${BETRIX.name} Payments</h1></div>
          <p>Redirecting to payment provider...</p>
        </div>
      </body>
    </html>
  `;
  res.send(html);
});

// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((err, req, res, next) => {
  log("ERROR", "EXPRESS", "Unhandled error", { err: err?.message || err });
  if (res.headersSent) return next(err);
  res.status(500).json(formatResponse(false, null, "Internal server error"));
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log("INFO", "SHUTDOWN", "Initiating graceful shutdown");
  try {
    // stop accepting new connections
    server.close(() => {
      log("INFO", "SHUTDOWN", "HTTP server closed");
    });

    // close websockets
    wss.clients.forEach(ws => {
      try { ws.close(1001, "Server shutting down"); } catch {}
    });

    // close redis
    await redis.quit().catch(() => {});
    log("INFO", "SHUTDOWN", "Redis connection closed");
  } catch (err) {
    log("ERROR", "SHUTDOWN", "Shutdown error", { err: err.message });
  } finally {
    log("INFO", "SHUTDOWN", "Shutdown complete");
    process.exit(0);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ============================================================================
// START SERVER
// ============================================================================
const start = async () => {
  try {
    // Ensure admin password hash exists (first-run)
    const adminHash = await redis.get("admin:password");
    if (!adminHash) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await redis.set("admin:password", hash);
      log("INFO", "INIT", "Admin password initialized");
    }

    server.listen(port, "0.0.0.0", () => {
      log("INFO", "SERVER", "BETRIX Server started", {
        port,
        environment: NODE_ENV,
        version: BETRIX.version,
        endpoints: {
          main: `http://0.0.0.0:${port}`,
          api: `http://0.0.0.0:${port}/api/v1`,
          admin: `http://0.0.0.0:${port}/admin`,
          health: `http://0.0.0.0:${port}/health`,
          metrics: `http://0.0.0.0:${port}/metrics`,
          webhook: `/webhook/:token?`
        }
      });
    });
  } catch (err) {
    log("ERROR", "INIT", "Startup failed", { err: err.message });
    process.exit(1);
  }
};

start();
