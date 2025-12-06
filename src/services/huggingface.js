import fetch from "node-fetch";
import { Logger } from "../utils/logger.js";

const logger = new Logger("HuggingFace");

class HuggingFaceService {
  constructor(models, token = null) {
    // models may be a comma-separated string or an array
    if (!models) {
      this.models = [];
    } else if (Array.isArray(models)) {
      this.models = models.filter(Boolean);
    } else if (typeof models === 'string') {
      this.models = models.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      this.models = [];
    }
    this.token = token || null;
    this.enabled = this.models.length > 0;
    this.lastUsed = null; // last successful model id
  }

  async _callModel(model, message) {
    // Use the new Hugging Face router endpoint
    const base = `https://router.huggingface.co/models/${model}`;
    const body = { inputs: message, options: { wait_for_model: true } };
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(body), timeout: 20000 });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HF ${res.status}: ${txt}`);
    }

    const data = await res.json();
    // normalize
    if (Array.isArray(data)) {
      const first = data[0];
      if (first && typeof first.generated_text === "string") return first.generated_text;
      if (first && typeof first === "string") return first;
    }
    if (typeof data.generated_text === "string") return data.generated_text;
    if (typeof data === 'string') return data;
    if (data && data.error) throw new Error(data.error);
    // fallback to JSON string
    return JSON.stringify(data).slice(0, 2000);
  }

  async chat(message, _context = {}) {
    if (!this.enabled) return null;
    let lastErr = null;
    for (const m of this.models) {
      try {
        const out = await this._callModel(m, message);
        this.lastUsed = m;
        return out;
      } catch (err) {
        lastErr = err;
        logger.warn(`HuggingFace model ${m} failed`, err?.message || String(err));
        // try next model
      }
    }
    logger.warn("All HuggingFace models failed", lastErr?.message || String(lastErr));
    throw lastErr || new Error("No HuggingFace models available");
  }

  async analyzeSport(sport, matchData, question) {
    return `HuggingFace analyze stub: ${sport} - ${question || "summary"}`;
  }

  isHealthy() {
    return this.enabled && this.models.length > 0;
  }
}

export { HuggingFaceService };
