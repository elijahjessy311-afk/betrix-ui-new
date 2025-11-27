import fetch from 'node-fetch';

class ScoreBatService {
  constructor(token = process.env.SCOREBAT_TOKEN || null, cache = null, opts = {}) {
    this.token = token;
    this.base = 'https://www.scorebat.com/video-api/v3';
    this.cache = cache; // optional CacheService instance
    this.retries = Number(opts.retries || 3);
    this.backoffBase = Number(opts.backoffBaseMs || 500);
    this.cacheTtl = Number(opts.cacheTtlSeconds || 60);
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async _fetchJsonWithRetry(url) {
    let lastErr = null;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const res = await fetch(url, { timeout: 10000 });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        return json;
      } catch (e) {
        lastErr = e;
        if (attempt < this.retries) {
          const backoff = this.backoffBase * Math.pow(2, attempt - 1);
          await this._sleep(backoff);
        }
      }
    }
    throw new Error(`ScoreBat fetch failed after ${this.retries} attempts: ${lastErr?.message || String(lastErr)}`);
  }

  _cacheKeyFor(name) { return `scorebat:proxy:${encodeURIComponent(name)}`; }

  async freeFeed() {
    const url = `${this.base}/free-feed/` + (this.token ? `?token=${this.token}` : '');
    const key = this._cacheKeyFor('free:' + (this.token || 'anon'));
    if (this.cache) {
      const cached = await this.cache.get(key).catch(() => null);
      if (cached) return cached;
    }
    const json = await this._fetchJsonWithRetry(url);
    if (this.cache) await this.cache.set(key, json, this.cacheTtl).catch(() => {});
    return json;
  }

  async featured() {
    const url = `${this.base}/featured-feed/` + (this.token ? `?token=${this.token}` : '');
    const key = this._cacheKeyFor('featured:' + (this.token || 'anon'));
    if (this.cache) {
      const cached = await this.cache.get(key).catch(() => null);
      if (cached) return cached;
    }
    const json = await this._fetchJsonWithRetry(url);
    if (this.cache) await this.cache.set(key, json, this.cacheTtl).catch(() => {});
    return json;
  }
}

export default ScoreBatService;
