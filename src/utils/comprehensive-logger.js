/**
 * Comprehensive Logger with Analytics
 */

import fs from "fs";
import path from "path";
void path;

class ComprehensiveLogger {
  constructor(module, redis = null) {
    this.module = module;
    this.redis = redis;
    this.logFile = `logs/${module}.log`;
    this.initLogFile();
  }

  initLogFile() {
    const logsDir = "logs";
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  info(msg, data = {}) {
    this.log("INFO", msg, data);
  }

  error(msg, err) {
    this.log("ERROR", msg, { error: err?.message || String(err) });
  }

  warn(msg, data = {}) {
    this.log("WARN", msg, data);
  }

  debug(msg, data = {}) {
    this.log("DEBUG", msg, data);
  }

  log(level, msg, data) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level} [${this.module}] ${msg}`;
    console.log(logEntry, data);
    
    try {
      fs.appendFileSync(this.logFile, `${logEntry} ${JSON.stringify(data)}\n`);
    } catch (e) {
      console.error("Log write failed", e);
    }
  }

  async trackMetric(key, _value) {
    if (this.redis) {
      await this.redis.incr(`metrics:${key}`);
    }
    void _value;
  }
}

export { ComprehensiveLogger };
