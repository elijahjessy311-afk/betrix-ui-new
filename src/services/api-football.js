/**
 * API-Football (RapidAPI) integration
 * Modern caching and error handling
 */

import { Logger } from "../utils/logger.js";
import { HttpClient } from "./http-client.js";
import { CacheService } from "../utils/cache.js";
import { CONFIG } from "../config.js";

const logger = new Logger("APIFootball");
void logger;

class APIFootballService {
  constructor(redis) {
    this.redis = redis;
    this.cache = new CacheService(redis);
    this.baseUrl = CONFIG.API_FOOTBALL.BASE;
    this.apiKey = CONFIG.API_FOOTBALL.KEY;
    this.tz = CONFIG.TZ;
  }

  /**
   * Get live matches
   */
  async getLive() {
    const cacheKey = `api:live:${this.tz}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await HttpClient.fetch(
      `${this.baseUrl}/fixtures?live=all&timezone=${encodeURIComponent(this.tz)}`,
      { headers: { "x-apisports-key": this.apiKey } },
      "APIFootball.live"
    );

    await this.cache.set(cacheKey, data, 30);
    return data;
  }

  /**
   * Get fixtures by league and season
   */
  async getFixtures(league, season) {
    const cacheKey = `api:fixtures:${league}:${season}:${this.tz}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await HttpClient.fetch(
      `${this.baseUrl}/fixtures?league=${league}&season=${season}&timezone=${encodeURIComponent(this.tz)}`,
      { headers: { "x-apisports-key": this.apiKey } },
      "APIFootball.fixtures"
    );

    await this.cache.set(cacheKey, data, 300);
    return data;
  }

  /**
   * Get fixtures by date
   */
  async getFixturesByDate(date, league = null) {
    const cacheKey = `api:fixtures:date:${date}:${league || "all"}:${this.tz}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/fixtures?date=${encodeURIComponent(date)}${
      league ? `&league=${encodeURIComponent(league)}` : ""
    }&timezone=${encodeURIComponent(this.tz)}`;

    const data = await HttpClient.fetch(
      url,
      { headers: { "x-apisports-key": this.apiKey } },
      "APIFootball.fixturesByDate"
    );

    await this.cache.set(cacheKey, data, 300);
    return data;
  }

  /**
   * Get next upcoming fixtures
   */
  async getNextFixtures(count = 10, league = null) {
    const cacheKey = `api:next:${count}:${league || "all"}:${this.tz}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/fixtures?next=${count}${
      league ? `&league=${encodeURIComponent(league)}` : ""
    }&timezone=${encodeURIComponent(this.tz)}`;

    const data = await HttpClient.fetch(
      url,
      { headers: { "x-apisports-key": this.apiKey } },
      "APIFootball.nextFixtures"
    );

    await this.cache.set(cacheKey, data, 300);
    return data;
  }

  /**
   * Get league standings
   */
  async getStandings(league, season) {
    const cacheKey = `api:standings:${league}:${season}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await HttpClient.fetch(
      `${this.baseUrl}/standings?league=${league}&season=${season}`,
      { headers: { "x-apisports-key": this.apiKey } },
      "APIFootball.standings"
    );

    await this.cache.set(cacheKey, data, 21600); // 6 hours
    return data;
  }

  /**
   * Get odds for fixture
   */
  async getOdds(fixtureId) {
    const cacheKey = `api:odds:${fixtureId}:${this.tz}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await HttpClient.fetch(
      `${this.baseUrl}/odds?fixture=${fixtureId}&timezone=${encodeURIComponent(this.tz)}`,
      { headers: { "x-apisports-key": this.apiKey } },
      "APIFootball.odds"
    );

    await this.cache.set(cacheKey, data, 120); // 2 minutes
    return data;
  }

  /**
   * Get odds by date
   */
  async getOddsByDate(date, league = null) {
    const cacheKey = `api:odds:date:${date}:${league || "all"}:${this.tz}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/odds?date=${encodeURIComponent(date)}${
      league ? `&league=${encodeURIComponent(league)}` : ""
    }&timezone=${encodeURIComponent(this.tz)}`;

    const data = await HttpClient.fetch(
      url,
      { headers: { "x-apisports-key": this.apiKey } },
      "APIFootball.oddsByDate"
    );

    await this.cache.set(cacheKey, data, 120);
    return data;
  }

  /**
   * Normalize league identifier
   */
  static normalizeLeague(token) {
    if (!token) return null;
    const normalized = String(token).toLowerCase().replace(/\s+/g, "");
    if (/^\d+$/.test(normalized)) return Number(normalized);
    return CONFIG.LEAGUES[normalized] || null;
  }
}

export { APIFootballService };
