/**
 * FreeSportsService
 * - Uses public web endpoints (Wikipedia REST + MediaWiki) to fetch league summaries and standings
 * - No API keys required
 */

import fetch from 'node-fetch';
import { load as loadCheerio } from 'cheerio';
import { Logger } from '../utils/logger.js';

const logger = new Logger('FreeSports');

class FreeSportsService {
  constructor(redis = null) {
    this.redis = redis;
    this.cacheTTL = 60 * 60 * 24; // 1 day
  }

  // Search Wikipedia for a matching page title for a league name
  async searchWiki(title) {
    try {
      if (!title) return null;
      const key = `free:wikidata:search:${title.toLowerCase()}`;
      if (this.redis) {
        const cached = await this.redis.get(key).catch(() => null);
        if (cached) return cached;
      }

      const q = encodeURIComponent(title);
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=5`;
      const res = await fetch(url, { headers: { 'User-Agent': 'BETRIX/1.0 (bot)' } });
      const j = await res.json();
      const first = j?.query?.search?.[0];
      const result = first?.title || null;
      if (result && this.redis) {
        await this.redis.set(key, result).catch(() => {});
        await this.redis.expire(key, this.cacheTTL).catch(() => {});
      }
      return result;
    } catch (err) {
      logger.warn('Wiki search failed', err?.message || String(err));
      return null;
    }
  }

  // Get summary for a page title via the REST summary endpoint
  async getLeagueSummary(title) {
    try {
      if (!title) return null;
      const key = `free:wikidata:summary:${title.toLowerCase()}`;
      if (this.redis) {
        const cached = await this.redis.get(key).catch(() => null);
        if (cached) return JSON.parse(cached);
      }

      const encoded = encodeURIComponent(title.replace(/ /g, '_'));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'BETRIX/1.0 (bot)' } });
      if (!res.ok) return null;
      const j = await res.json();
      const out = {
        title: j.title,
        extract: j.extract,
        url: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
      };
      if (this.redis) {
        await this.redis.set(key, JSON.stringify(out)).catch(() => {});
        await this.redis.expire(key, this.cacheTTL).catch(() => {});
      }
      return out;
    } catch (err) {
      logger.warn('getLeagueSummary failed', err?.message || String(err));
      return null;
    }
  }

  // Parse standings table from a Wikipedia page via parse API and cheerio
  async getStandings(pageTitle, maxRows = 10) {
    try {
      if (!pageTitle) return null;
      const key = `free:wikidata:standings:${pageTitle.toLowerCase()}`;
      if (this.redis) {
        const cached = await this.redis.get(key).catch(() => null);
        if (cached) return JSON.parse(cached);
      }

      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'BETRIX/1.0 (bot)' } });
      if (!res.ok) return null;
      const j = await res.json();
      const html = j?.parse?.text?.['*'];
      if (!html) return null;

      const $ = loadCheerio(html);

      // Look for the first table that looks like a standings table
      const tables = $('table.wikitable, table.sortable');
      let chosen = null;
      tables.each((i, t) => {
        if (chosen) return;
        const headers = $(t).find('th').map((i, h) => $(h).text().toLowerCase()).get().join('|');
        // crude check: headers contain 'pos' or 'p' and 'pts'
        if (headers.includes('pos') || headers.includes('p') || headers.includes('pts') || headers.includes('points')) {
          chosen = t;
        }
      });

      if (!chosen) {
        // fallback to first wikitable
        chosen = tables.get(0);
      }

      if (!chosen) return null;

      const rows = [];
      $(chosen)
        .find('tr')
        .each((i, tr) => {
          if (i === 0) return; // skip header
          const cols = $(tr)
            .find('td, th')
            .map((j, td) => $(td).text().trim())
            .get()
            .filter(Boolean);
          if (!cols || cols.length === 0) return;
          // attempt to map: [pos, team, played, win, draw, loss, pts]
          const entry = {
            raw: cols,
          };
          // heuristics
          if (cols.length >= 2) {
            entry.rank = cols[0];
            entry.team = cols[1];
          }
          if (cols.length >= 7) {
            entry.played = cols[2];
            entry.win = cols[3];
            entry.draw = cols[4];
            entry.loss = cols[5];
            entry.points = cols[6];
          } else if (cols.length >= 5) {
            entry.played = cols[2];
            entry.points = cols[cols.length - 1];
          }
          rows.push(entry);
        });

      const out = rows.slice(0, maxRows);
      if (this.redis) {
        await this.redis.set(key, JSON.stringify(out)).catch(() => {});
        await this.redis.expire(key, this.cacheTTL).catch(() => {});
      }
      return out;
    } catch (err) {
      logger.warn('getStandings failed', err?.message || String(err));
      return null;
    }
  }
}

export { FreeSportsService };
