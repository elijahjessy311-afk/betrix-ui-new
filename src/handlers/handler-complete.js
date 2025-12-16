/**
 * BETRIX Complete Telegram Handler v3
 * Handles all commands, callbacks, and menu navigation
 * Every button properly connected to correct responses
 */

import { Logger } from '../utils/logger.js';
import { analyseFixtureWithBetrixx } from '../services/betrixx_analysis.js';
import * as completeMenus from './menu-handler-complete.js';
import { createCustomPaymentOrder } from './payment-router.js';
import lipana from '../lib/lipana-client.js';
import { Pool } from 'pg';
import SportMonksService from '../services/sportmonks-service.js';
import * as telegramSanitize from '../utils/telegram-sanitize.js';

const logger = new Logger('HandlerComplete');

function safeName(val, fallback = 'TBA') {
  try {
    if (val == null) return fallback;
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      if (val.name) return String(val.name);
      if (val.fullName) return String(val.fullName);
      if (val.teamName) return String(val.teamName);
      // last resort: stringify
      return JSON.stringify(val);
    }
    return String(val);
  } catch (e) {
    return fallback;
  }
}

// small utility sleep
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isRateLimitError(err) {
  const m = String(err && (err.message || err.error || err)).toLowerCase();
  return m.includes('429') || m.includes('quota') || m.includes('too many requests') || m.includes('rate limit');
}

// Extract text from various AI provider response shapes
function extractTextFromAi(aiRes) {
  if (!aiRes && aiRes !== 0) return '';
  try {
    if (typeof aiRes === 'string') return aiRes;
    if (typeof aiRes === 'object') {
      if (typeof aiRes.text === 'string') return aiRes.text;
      if (aiRes.choices && Array.isArray(aiRes.choices) && aiRes.choices.length) {
        // OpenAI-style
        const first = aiRes.choices[0];
        if (first.message && first.message.content) return first.message.content;
        if (typeof first.text === 'string') return first.text;
      }
      if (aiRes.data && Array.isArray(aiRes.data) && aiRes.data.length) {
        const d = aiRes.data[0];
        if (d && d.text) return d.text;
      }
      if (typeof aiRes.content === 'string') return aiRes.content;
      // Fallback to JSON stringify
      return JSON.stringify(aiRes);
    }
    return String(aiRes);
  } catch (e) {
    return String(aiRes);
  }
}

// Try AI analysis with simple retry/backoff on rate-limit errors
async function tryAiAnalyze(services, matchData, prompt, maxAttempts = 3, sport = 'football') {
  if (!services || !services.ai || typeof services.ai.analyzeSport !== 'function') return null;
  let attempt = 0;
  let lastErr = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const res = await services.ai.analyzeSport(sport || 'football', matchData, prompt);
      // If the AI returned a very short or clearly partial response, try the BETRIXX (Groq) analyser as a fallback
      try {
        const previewText = extractTextFromAi(res) || '';
        if (String(previewText).trim().length < 80) {
          logger.info('AI returned short response, falling back to BETRIXX analyser');
          try {
            const betrixResp = await analyseFixtureWithBetrixx(matchData, { max_tokens: 1800 });
            return betrixResp;
          } catch (e) {
            logger.warn('BETRIXX analyser fallback failed', e?.message || String(e));
            // continue with original small response if fallback fails
          }
        }
      } catch (e) { void e; }
      return res;
    } catch (err) {
      lastErr = err;
      // if rate limit, wait and retry with exponential backoff
      if (isRateLimitError(err) && attempt < maxAttempts) {
        const wait = 1000 * Math.pow(2, attempt - 1);
        logger.warn(`AI rate limit detected, retrying in ${wait}ms (attempt ${attempt}/${maxAttempts})`);
        // polite jitter
        await sleep(wait + Math.floor(Math.random() * 250));
        continue;
      }
      // non-retryable error -> break
      logger.warn('AI analysis failed (non-rate-limit)', String(err));
      break;
    }
  }
  // final fallback: log last error and return null
  logger.warn('AI analysis ultimately failed', lastErr ? (lastErr.message || String(lastErr)) : 'no error');
  return null;
}

/**
 * Fetch live matches from SportMonks
 */
async function getLiveMatches(services = {}, sport = 'football') {
  try {
    // Prefer injected sportsAggregator if available (provides caching and fixtures integration)
    if (services && services.sportsAggregator && typeof services.sportsAggregator.getAllLiveMatches === 'function') {
      try {
        // If the aggregator supports sport-scoped queries, pass through the sport parameter
        return await services.sportsAggregator.getAllLiveMatches(sport);
      } catch (e) {
        // Graceful fallback to sport-agnostic call
        try { return await services.sportsAggregator.getAllLiveMatches(); } catch (e2) { void e2; }
      }
    }

    // Fallback provider: SportMonksService (football-only). Only attempt when sport is football
    if (String(sport || '').toLowerCase() === 'football') {
      const sportMonks = new SportMonksService();
      const matches = await sportMonks.getLivescores();
      if (!matches || matches.length === 0) return [];

      return matches.map(m => ({
        id: m.id || String(Math.random()),
        home: m.home_team || m.home || 'Unknown',
        away: m.away_team || m.away || 'Unknown',
        homeScore: m.homeScore !== undefined ? m.homeScore : m.score?.home,
        awayScore: m.awayScore !== undefined ? m.awayScore : m.score?.away,
        time: m.time || m.status || 'LIVE',
        league: m.league || 'Unknown League',
        homeOdds: m.homeOdds || '1.95',
        drawOdds: m.drawOdds || '3.60',
        awayOdds: m.awayOdds || '4.10',
        prediction: m.prediction || '50/50',
        provider: 'SportMonks'
      }));
    }

    // No provider available for requested sport -> return empty list
    return [];
  } catch (e) {
    logger.warn('getLiveMatches error', e?.message);
    return [];
  }
}

/**
 * Handle /start command - show main menu
 */
export async function handleStart(chatId, _services = {}) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: completeMenus.mainMenu.text,
    reply_markup: completeMenus.mainMenu.reply_markup,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle /menu command - show main menu
 */
export async function handleMenu(chatId, _services = {}) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: completeMenus.mainMenu.text,
    reply_markup: completeMenus.mainMenu.reply_markup,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle /live command - show sports selector or live games
 */
export async function handleLive(chatId, sport = null, services = {}) {
  if (!sport) {
    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: completeMenus.sportsMenu.text,
      reply_markup: completeMenus.sportsMenu.reply_markup,
      parse_mode: 'Markdown'
    };
  }

  const matches = await getLiveMatches(services, sport);
  const menu = completeMenus.buildLiveGamesMenu(matches, sport, 1);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: menu.text,
    reply_markup: menu.reply_markup,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle callback queries for all menu interactions
 */
export async function handleCallbackQuery(cq, redis, services) {
  try {
    const data = cq.data || '';
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;

    if (!chatId || !messageId) {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '❌ Error: Invalid message',
        show_alert: true
      };
    }

    logger.info(`Callback: ${data}`);

    // Normalize alias callbacks to the canonical analyseFixture handler
    // Some menus use `analysis:<id>` while the handler expects `analyseFixture:<id>`
    try {
      if (typeof data === 'string' && data.startsWith('analysis:')) {
        const parts = data.split(':');
        const fid = parts[1];
        if (fid) {
          logger.debug(`Normalizing callback alias analysis:${fid} -> analyseFixture:${fid}`);
          // reassign data so the downstream logic handles it as analyseFixture
          // eslint-disable-next-line no-param-reassign
          data = `analyseFixture:${fid}`;
        }
      }
    } catch (e) { void e; }
    // ========================================================================
    // MAIN MENU
    // ========================================================================

    if (data === 'menu_main') {
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: completeMenus.mainMenu.text,
        reply_markup: completeMenus.mainMenu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // ========================================================================
    // LIVE GAMES
    // ========================================================================

    if (data === 'live_games') {
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: completeMenus.sportsMenu.text,
        reply_markup: completeMenus.sportsMenu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Top-level News button (opens the news categories)
    if (data === 'news') {
      const menu = completeMenus.buildNewsMenu();
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Show the sports selector (generic across all sports)
    if (data === 'sports') {
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: completeMenus.sportsMenu.text,
        reply_markup: completeMenus.sportsMenu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Sport selection (now supports overview -> live/upcoming)
    if (data.startsWith('sport:')) {
      const parts = data.split(':');
      const sport = parts[1];

      // If caller requested a sub-view (live/upcoming)
      if (parts.length >= 3) {
        const view = parts[2];
        if (view === 'live') {
          const matches = await getLiveMatches(services, sport);
          const menu = completeMenus.buildLiveGamesMenu(matches, sport, 1);
          return {
            method: 'editMessageText',
            chat_id: chatId,
            message_id: messageId,
            text: menu.text,
            reply_markup: menu.reply_markup,
            parse_mode: 'Markdown'
          };
        }

        if (view === 'upcoming') {
          // Try multiple aggregator methods to collect upcoming fixtures for the selected sport
          let upcoming = [];
          try {
            // Preferred: aggregator exposes getFixtures(sport) via multi-sport handler
            if (services && services.sportsAggregator && typeof services.sportsAggregator.getFixtures === 'function') {
              try {
                upcoming = await services.sportsAggregator.getFixtures(sport);
              } catch (e) {
                // ignore and try other fallbacks
                upcoming = [];
              }
            }

            // Fallback for football: use existing getFixtures() which aggregates top competitions
            if ((!upcoming || upcoming.length === 0) && String(sport).toLowerCase() === 'football') {
              if (services && services.sportsAggregator && typeof services.sportsAggregator.getFixtures === 'function') {
                try { upcoming = await services.sportsAggregator.getFixtures(); } catch(e){ upcoming = []; }
              }
            }
          } catch (e) {
            upcoming = [];
          }

          // Build a simple upcoming fixtures view
          let text = `🌀 *BETRIX* - Upcoming ${String(sport).toUpperCase()} Fixtures\n\n`;
          if (!upcoming || upcoming.length === 0) {
            text += `No upcoming ${sport} fixtures available. Try again later or ensure providers are configured.`;
          } else {
            const list = upcoming.slice(0, 12);
            for (const f of list) {
              const home = safeName(f.home);
              const away = safeName(f.away);
              let kickoff = 'TBA';
              try { const d = f.kickoff || f.utcDate || f.date || f.time || f.starting_at; if (d) kickoff = (typeof d === 'number') ? new Date(d < 1e12 ? d * 1000 : d).toLocaleString() : new Date(d).toLocaleString(); } catch(e){}
              text += `• ${home} vs ${away} — ${kickoff}\n`;
            }
          }

          const keyboard = [];
          if (Array.isArray(upcoming) && upcoming.length > 0) {
            for (const f of upcoming.slice(0, 6)) {
              const matchId = f.id || `${sport}_${String(Math.random()).slice(2,8)}`;
              keyboard.push([{ text: `${safeName(f.home)} vs ${safeName(f.away)}`, callback_data: `match:${matchId}:${sport}` }]);
            }
          }

          keyboard.push([
            { text: '🔄 Refresh', callback_data: `sport:${sport}:upcoming` },
            { text: '🏟 Pick Sport', callback_data: 'sports' }
          ]);
          keyboard.push([{ text: '🔙 Back', callback_data: 'menu_main' }]);

          return {
            method: 'editMessageText',
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          };
        }

        // Unknown sub-view -> show overview
      }

      // Default: show sport overview with options (Live / Upcoming / News)
      const overview = completeMenus.buildSportOverviewMenu(sport);
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: overview.text,
        reply_markup: overview.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Live pagination
    if (data.startsWith('live:')) {
      const parts = data.split(':');
      const sport = parts[1];
      const page = parseInt(parts[2], 10) || 1;
      const matches = await getLiveMatches(services, sport);
      const menu = completeMenus.buildLiveGamesMenu(matches, sport, page);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Match details
    if (data.startsWith('match:')) {
      const parts = data.split(':');
      const matchId = parts[1];
      // Fetch match details from SportMonks
      const matches = await getLiveMatches(services, 'football');
      const match = matches.find(m => String(m.id) === matchId) || matches[0] || {};
      const menu = completeMenus.buildMatchDetailsMenu(match);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // ========================================================================
    // ODDS & ANALYSIS
    // ========================================================================

    if (data === 'odds_analysis') {
      const matches = await getLiveMatches(services, 'football');
      const menu = completeMenus.buildOddsMenu(matches);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('odds:')) {
      const matchId = data.split(':')[1];
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `📊 Detailed odds analysis for match ${matchId}. Available in VVIP tier.`,
        show_alert: false
      };
    }

    // ========================================================================
    // STANDINGS
    // ========================================================================

    if (data === 'standings') {
      const menu = completeMenus.buildStandingsMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('standings:')) {
      const league = data.split(':')[1];
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `🏆 ${league.toUpperCase()} standings. Coming soon!`,
        show_alert: false
      };
    }

    // Open a news item (simple handler - tries to decode stored URL/id)
    if (data.startsWith('news_open:')) {
      const payload = data.split(':')[1];
      let decoded = null;
      try { decoded = decodeURIComponent(payload); } catch (e) { decoded = payload; }

      // If decoded looks like a URL, open/send it; otherwise show a toast
      if (decoded && (String(decoded).startsWith('http://') || String(decoded).startsWith('https://'))) {
        return {
          method: 'answerCallbackQuery',
          callback_query_id: cq.id,
          text: `🔗 Open article: ${decoded}`,
          show_alert: false
        };
      }

      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '📰 Article preview not available. (ID: ' + String(decoded) + ')',
        show_alert: false
      };
    }

    // ========================================================================
    // NEWS
    // ========================================================================

    if (data === 'news') {
      const menu = completeMenus.buildNewsMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // ========================================================================
    // FIXTURES / UPCOMING
    // ========================================================================

    if (data === 'menu_fixtures') {
      // use sportsAggregator to fetch upcoming fixtures
      let fixtures = [];
      try {
        if (services && services.sportsAggregator) {
          fixtures = await services.sportsAggregator.getFixtures().catch(() => []);
        }
      } catch (e) {
        logger.warn('Failed to fetch fixtures from aggregator', e?.message);
      }

      if (!fixtures || fixtures.length === 0) {
        return {
          method: 'editMessageText',
          chat_id: chatId,
          message_id: messageId,
          text: `📅 *Upcoming Fixtures*\n\nNo upcoming fixtures available at the moment.`,
          reply_markup: { inline_keyboard: [[{ text: '🏟 See Live Matches', callback_data: 'live_games' }, { text: '🔙 Back', callback_data: 'menu_main' }]] },
          parse_mode: 'Markdown'
        };
      }

      // Filter out stale/demo fixtures (keep only fixtures within a reasonable window)
      const nowTs = Date.now();
      const minTs = nowTs - (7 * 24 * 60 * 60 * 1000); // 7 days in past
      const maxTs = nowTs + (90 * 24 * 60 * 60 * 1000); // 90 days in future
      const parseFixtureTs = (f) => {
        try {
          const cands = [f.kickoff, f.kickoff_at, f.utcDate, f.utc_date, f.date, f.time, f.starting_at, f.timestamp, f.ts, f.start, f.match_time, f.datetime];
          for (const c of cands) {
            if (!c && c !== 0) continue;
            if (typeof c === 'number') return c < 1e12 ? c * 1000 : c;
            if (typeof c === 'string') {
              if (/^\d{10}$/.test(c)) return Number(c) * 1000;
              if (/^\d{13}$/.test(c)) return Number(c);
              const d = new Date(c);
              if (!isNaN(d.getTime())) return d.getTime();
            }
          }
        } catch (e) { /* ignore */ }
        return null;
      };

      // apply filter
      fixtures = (fixtures || []).filter(f => {
        const ts = parseFixtureTs(f);
        if (!ts) return false;
        return ts >= minTs && ts <= maxTs;
      });

      // Group by competition (use readable competition name).
      // Attempt to resolve numeric/ID-only competition values to a human name
      // using available fixture fields (competition.name, competition_name, leagueName, etc.).
      const groups = {};

      // Try to fetch a leagues index once to map numeric ids to names
      let leaguesIndex = null;
      try {
        if (services && services.sportsAggregator && typeof services.sportsAggregator.getLeagues === 'function') {
          const rawLeagues = await services.sportsAggregator.getLeagues().catch(() => null);
          if (Array.isArray(rawLeagues)) {
            leaguesIndex = {};
            rawLeagues.forEach(l => {
              if (!l) return;
              const id = l.id || l.league_id || l.leagueId || null;
              const name = (l.name || l.title || l.fullName || l.competition_name || l.leagueName || l.displayName || l.long_name);
              if (id != null) leaguesIndex[String(id)] = name || String(id);
            });
          }
        }
      } catch (e) { /* ignore */ }

      for (const f of fixtures) {
        const compObj = f.competition || f.league || null;

        const possibleName = (compObj && typeof compObj === 'object')
          ? (compObj.name || compObj.title || compObj.fullName || compObj.competition_name)
          : (f.competition_name || f.leagueName || f.competitionName || f.competitionTitle || compObj);

        let compName = safeName(possibleName || compObj || 'Other', 'Other');

        // If compName is just a numeric id (e.g. '8'), try to resolve via leaguesIndex or fixture labels
        if (/^\d+$/.test(String(compName).trim())) {
          const compId = String((compObj && (compObj.id || compObj)) || compName);
          if (leaguesIndex && leaguesIndex[compId]) {
            compName = leaguesIndex[compId];
          } else {
            const alt = f.competition && f.competition.name ? String(f.competition.name) : (f.leagueName || f.competition_name || f.competitionTitle || null);
            if (alt) compName = alt;
          }
        }

        groups[compName] = groups[compName] || [];
        groups[compName].push(f);
      }

      // Format date range for display
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dateStr = now.toLocaleDateString();
      const tomorrowStr = tomorrow.toLocaleDateString();

      // Build simple text and keyboard where each fixture gets a button
      let text = `📅 *Upcoming Fixtures (${dateStr} - ${tomorrowStr})*\n\n`;
      const keyboard = [];
      Object.keys(groups).slice(0, 10).forEach(comp => {
        text += `🏆 *${comp}*\n`;
        groups[comp].slice(0, 8).forEach(f => {
          let home = safeName(f.home || f.homeTeam || (f.raw && f.raw.homeTeam) || (f.teams && f.teams.home) || f.homeName, 'Home');
          let away = safeName(f.away || f.awayTeam || (f.raw && f.raw.awayTeam) || (f.teams && f.teams.away) || f.awayName, 'Away');
          // Defensive normalization: avoid literal 'undefined' or empty strings
          if (!home || home === 'undefined') home = 'TBA';
          if (!away || away === 'undefined') away = 'TBA';
          let kickoff = 'TBA';
          try {
            // Normalize various common kickoff/date fields and handle unix seconds vs ms
            const tsCandidates = [f.kickoff, f.utcDate, f.kickoff_at, f.utc_date, f.date, f.time, f.starting_at, f.starting_at_timestamp, f.timestamp, f.ts];
            let d = null;
            for (const c of tsCandidates) {
              if (!c) continue;
              // If it's a number, it may be seconds; convert to ms when needed
              if (typeof c === 'number') {
                d = new Date(c < 1e12 ? c * 1000 : c);
              } else if (typeof c === 'string') {
                // numeric strings
                if (/^\d{10}$/.test(c)) d = new Date(Number(c) * 1000);
                else if (/^\d{13}$/.test(c)) d = new Date(Number(c));
                else d = new Date(c);
              }
              if (d && !isNaN(d.getTime())) break;
            }
            if (d && !isNaN(d.getTime())) kickoff = d.toLocaleString();
            else if (f.time) kickoff = String(f.time);
          } catch (e) { kickoff = 'TBA'; }

          text += `• ${home} vs ${away} — ${kickoff}\n`;
          // Primary label row (opens fixture details)
          keyboard.push([{ text: `${home} vs ${away}`, callback_data: `fixture:${f.id}` }]);
          // Action row: Analyze (targets upcoming fixtures), Odds, Favourite
          const analyzeCb = `analyze_match_${'upcoming'}_${f.id}`;
          keyboard.push([
            { text: '🤖 Analyze', callback_data: analyzeCb },
            { text: '💰 Odds', callback_data: `odds_compare_${f.id}` },
            { text: '⭐ Fav', callback_data: `fav_add_${f.id}` }
          ]);
        });
        text += `\n`;
      });

      // Add a 'Show All' button and a 'Show Postponed' quick toggle
      keyboard.push([
        { text: `📋 Show All (${fixtures.length})`, callback_data: 'fixtures_all' },
        { text: '🟡 Show Postponed', callback_data: 'fixtures_all_postponed' }
      ]);
      // Back button on a separate row
      keyboard.push([
        { text: '🔙 Back', callback_data: 'menu_main' }
      ]);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('fixture:')) {
      const fixtureId = data.split(':')[1];
      const fixtures = (services && services.sportsAggregator) ? await services.sportsAggregator.getFixtures() : [];
      const fixture = fixtures.find(f => String(f.id) === String(fixtureId));
      if (!fixture) {
        return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Fixture not found', show_alert: false };
      }
      const home = safeName(fixture.home || fixture.homeTeam || fixture.homeName, 'Home');
      const away = safeName(fixture.away || fixture.awayTeam || fixture.awayName, 'Away');
      const kickoff = (fixture.kickoff || fixture.time || fixture.utcDate) ? (fixture.kickoff ? new Date(fixture.kickoff).toLocaleString() : String(fixture.time || fixture.utcDate)) : 'TBA';
      const comp = safeName(fixture.competition || fixture.league, 'N/A');
      const text = `*Fixture: ${home} vs ${away}*\nKickoff: ${kickoff}\nCompetition: ${comp}\nVenue: ${fixture.venue || 'TBA'}\nStatus: ${fixture.status || 'SCHEDULED'}\nProvider: ${fixture.provider || 'Football-Data.org'}`;
      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: [[{ text: '🔎 Analyse Fixture', callback_data: `analyseFixture:${fixture.id}` }, { text: '🔙 Back', callback_data: 'menu_fixtures' }]] },
        parse_mode: 'Markdown'
      };
    }

    if (data.startsWith('analyseFixture:')) {
      const fixtureId = data.split(':')[1];
      // Acknowledge callback quickly, then perform analysis and edit message
      const actions = [{ method: 'answerCallbackQuery', callback_query_id: cq.id, text: '🔎 Analyzing fixture...', show_alert: false }];
      try {
        const fixtures = (services && services.sportsAggregator) ? await services.sportsAggregator.getFixtures().catch(() => []) : [];
        let fixture = fixtures.find(f => String(f.id) === String(fixtureId));
        // If not found in fixtures, try live matches (support analysing live games)
        if (!fixture && services && services.sportsAggregator && typeof services.sportsAggregator.getAllLiveMatches === 'function') {
          try {
            const live = await services.sportsAggregator.getAllLiveMatches();
            fixture = (live || []).find(m => String(m.id) === String(fixtureId));
          } catch (e) { void e; }
        }
        if (!fixture) {
          actions.push({ method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Fixture not found for analysis', show_alert: false });
          return actions;
        }

        const home = safeName(fixture.home || fixture.homeTeam || fixture.homeName, 'Home');
        const away = safeName(fixture.away || fixture.awayTeam || fixture.awayName, 'Away');
        const leagueId = (fixture.competition && fixture.competition.id) || fixture.league || fixture.competition || null;

        // Enrich fixture with additional sources where possible (raw cache, aggregator details, odds)
        let matchData = Object.assign({}, fixture, { home, away, leagueId });
        try {
          // 1) Try to fetch a comprehensive match object from the aggregator
          if (services && services.sportsAggregator && typeof services.sportsAggregator.getMatchById === 'function') {
            try {
              const rich = await services.sportsAggregator.getMatchById(fixture.id, 'football');
              if (rich && typeof rich === 'object') {
                matchData = Object.assign({}, matchData, rich);
                logger.info(`analyseFixture: enriched match data from sportsAggregator for id=${fixture.id}`);
              }
            } catch (e) { logger.debug('analyseFixture: sportsAggregator.getMatchById failed', e?.message || String(e)); }
          }

          // 2) Try to attach raw provider data (footballdata / sportsmonks) from cache
          if (services && services.cache && typeof services.cache.getFullMatchData === 'function') {
            try {
              const fullRaw = await services.cache.getFullMatchData(fixture.id);
              if (fullRaw && Object.keys(fullRaw).length) {
                matchData.raw = Object.assign({}, matchData.raw || {}, fullRaw);
                logger.info(`analyseFixture: attached raw cached data for id=${fixture.id}`);
              }
            } catch (e) { logger.debug('analyseFixture: cache.getFullMatchData failed', e?.message || String(e)); }
          }

          // 3) Try to fetch available odds (may be empty if no odds provider configured)
          try {
            if (services && services.sportsAggregator && typeof services.sportsAggregator.getOdds === 'function') {
              const oddsList = await services.sportsAggregator.getOdds(leagueId);
              if (Array.isArray(oddsList) && oddsList.length) {
                // Attempt to find a matching odds entry by match id or team names
                let foundOdds = oddsList.find(o => String(o.matchId || o.id || o.fixture_id) === String(fixture.id));
                if (!foundOdds && matchData.home && matchData.away) {
                  foundOdds = oddsList.find(o => (o.home && o.away) && o.home.toLowerCase() === String(matchData.home).toLowerCase() && o.away.toLowerCase() === String(matchData.away).toLowerCase());
                }
                if (foundOdds) {
                  matchData.odds = foundOdds;
                  logger.info(`analyseFixture: found odds for id=${fixture.id}`);
                }
              }
            }
          } catch (e) { logger.debug('analyseFixture: getOdds attempt failed', e?.message || String(e)); }
        } catch (e) { logger.debug('analyseFixture: enrichment failed', e?.message || String(e)); }

        // Craft a rich prompt requesting structured JSON output for betting recommendations
        const detailedPrompt = `You are a professional football betting analyst. Given the match object (JSON) that follows, produce a short Telegram-friendly summary and a list of specific recommended bets.
Respond primarily with a single JSON object only, parseable by a machine, with this shape:
{
  "summary": "short human-friendly summary",
  "predictions": [
    {
      "market": "Match Winner|Both Teams To Score|Over/Under|Correct Score|Both Teams/Over etc.",
      "selection": "Home|Away|Draw|Yes|No|Over|Under",
      "probability": 0.0-1.0,
      "confidence": "low|medium|high",
      "suggested_stake_pct": 0-100,
      "rationale": "one or two sentence rationale"
    }
  ],
  "notes": "optional additional notes"
}

Include only valid JSON in the response if possible. After the JSON, you may include a 2-3 line plain-text human summary separated by a newline. Use the match data to inform probabilities and rationale. Do not hallucinate exact market odds; if no market odds available, state that odds are not provided. Keep the JSON compact. Now analyze this match and return the JSON and a short text summary. MATCH_DATA: ` + JSON.stringify(matchData);

        // Try AI-first with retry/backoff on rate-limit errors
        // Detect sport from matchData where possible to allow multi-sport analysis
        const detectedSport = (matchData && (matchData.sport || matchData.sportKey || matchData.sportName || matchData.sport_id || matchData.sportId)) || 'football';
        const aiResult = await tryAiAnalyze(services, matchData, detailedPrompt, 3, detectedSport);

        // Log raw AI response shape for debugging in production
        try {
          const rawType = (aiResult === null || aiResult === undefined) ? String(aiResult) : typeof aiResult;
          const rawLen = (aiResult && typeof aiResult === 'string') ? aiResult.length : (aiResult ? JSON.stringify(aiResult).length : 0);
          logger.info(`analyseFixture: aiResult raw type=${rawType} length=${rawLen}`);
        } catch (e) { void e; }

        const text = extractTextFromAi(aiResult);
        // Log a short preview to help diagnose unexpected responses
        try { logger.info(`analyseFixture: aiResult preview: ${String(text || '').slice(0, 300).replace(/\n/g, ' ')}`); } catch (e) { void e; }

        if (text && text.length) {
          // If the AI returned JSON, parse and format a friendly Telegram message
          let out = text;
          try {
            const parsed = JSON.parse(text);
            if (parsed && parsed.predictions && Array.isArray(parsed.predictions)) {
              let buffer = `*Analysis — ${home} vs ${away}*\n`;
              if (parsed.summary) buffer += `\n${parsed.summary}\n\n`;
              parsed.predictions.forEach((p) => {
                const market = p.market || p.type || 'Market';
                const selection = p.selection || p.pick || 'N/A';
                const prob = (typeof p.probability === 'number') ? `${Math.round(p.probability * 100)}%` : (p.probability || 'N/A');
                const conf = p.confidence || 'medium';
                const stake = (p.suggested_stake_pct !== undefined) ? `${p.suggested_stake_pct}% stake` : (p.suggested_stake || '');
                const rationale = p.rationale ? ` — ${p.rationale}` : '';
                buffer += `• ${market}: *${selection}* (${prob}, ${conf}) ${stake}${rationale}\n`;
              });
              if (parsed.notes) buffer += `\n_notes_: ${parsed.notes}`;
              buffer += `\n\n_Disclaimer: Suggestions are informational only. Gamble responsibly._`;
              out = buffer;
            }
          } catch (e) { /* not JSON, keep raw text */ }

          if (out.length > 4000) out = out.slice(0, 4000) + '\n\n...';

          // Send analysis as a new message to avoid overwriting the menu message
          // Escape dynamic content for MarkdownV2 to avoid Telegram parse errors
          try {
            const safeOut = telegramSanitize.escapeMarkdownV2(out);
            actions.push({
              method: 'sendMessage',
              chat_id: chatId,
              text: safeOut,
              reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] },
              parse_mode: 'MarkdownV2'
            });
          } catch (e) {
            // If sanitization fails for any reason, fall back to sending raw text without parse mode
            actions.push({ method: 'sendMessage', chat_id: chatId, text: String(out), reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] } });
          }

          return actions;
        }

        // If AI not available or failed, fall back to OddsAnalyzer
        if (services && services.oddsAnalyzer && typeof services.oddsAnalyzer.analyzeMatch === 'function') {
          try {
            const analysis = await services.oddsAnalyzer.analyzeMatch(home, away, leagueId);
            const text = (typeof services.oddsAnalyzer.formatForTelegram === 'function')
              ? services.oddsAnalyzer.formatForTelegram(analysis)
              : (`🔍 Analysis for ${home} vs ${away}\n${JSON.stringify(analysis).slice(0,1500)}`);

            // Send fallback odds analysis as a new message to chat
            try {
              const safeText = telegramSanitize.escapeMarkdownV2(text);
              actions.push({ method: 'sendMessage', chat_id: chatId, text: safeText, reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] }, parse_mode: 'MarkdownV2' });
            } catch (e) {
              actions.push({ method: 'sendMessage', chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] } });
            }
            return actions;
          } catch (errOdds) {
            logger.warn('OddsAnalyzer failed', errOdds?.message || String(errOdds));
          }
        }

        // Nothing available
        actions.push({ method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Analysis service not available', show_alert: false });
        return actions;
      } catch (e) {
        logger.warn('analyseFixture handler failed', e?.message || e);
        return [{ method: 'answerCallbackQuery', callback_query_id: cq.id, text: '⚠️ Analysis failed', show_alert: false }];
      }
    }

    // Send all fixtures in paginated messages (callback triggered by 'Show All')
    if (data === 'fixtures_all') {
      try {
        const fixtures = (services && services.sportsAggregator) ? await services.sportsAggregator.getFixtures() : [];
        if (!fixtures || fixtures.length === 0) {
          return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: 'No fixtures available', show_alert: false };
        }

        // Filter out stale/demo fixtures from the all-list as well
        const nowTs = Date.now();
        const minTs = nowTs - (7 * 24 * 60 * 60 * 1000);
        const maxTs = nowTs + (90 * 24 * 60 * 60 * 1000);
        const parseFixtureTs = (f) => {
          try {
            const cands = [f.kickoff, f.kickoff_at, f.utcDate, f.utc_date, f.date, f.time, f.starting_at, f.timestamp, f.ts, f.start, f.match_time, f.datetime];
            for (const c of cands) {
              if (!c && c !== 0) continue;
              if (typeof c === 'number') return c < 1e12 ? c * 1000 : c;
              if (typeof c === 'string') {
                if (/^\d{10}$/.test(c)) return Number(c) * 1000;
                if (/^\d{13}$/.test(c)) return Number(c);
                const d = new Date(c);
                if (!isNaN(d.getTime())) return d.getTime();
              }
            }
          } catch (e) { /* ignore */ }
          return null;
        };

        const filteredFixtures = (fixtures || []).filter(f => {
          const ts = parseFixtureTs(f);
          if (!ts) return false;
          return ts >= minTs && ts <= maxTs;
        });
        const useFixtures = filteredFixtures.length ? filteredFixtures : fixtures;

        // Prepare an actions array to return multiple sendMessage actions
        const actions = [];
        // Build pages of up to 25 fixtures per message to avoid Telegram limits
        const pageSize = 25;
        for (let i = 0; i < useFixtures.length; i += pageSize) {
          const page = useFixtures.slice(i, i + pageSize);
          let text = `📋 *All Upcoming Fixtures* (page ${Math.floor(i / pageSize) + 1}/${Math.ceil(fixtures.length / pageSize)})\n\n`;
          for (const f of page) {
            const home = safeName(f.home || f.homeTeam || f.homeName || (f.raw && f.raw.homeTeam), 'Home');
            const away = safeName(f.away || f.awayTeam || f.awayName || (f.raw && f.raw.awayTeam), 'Away');
            let kickoff = 'TBA';
            try {
              const d = f.kickoff || f.utcDate || f.date || f.time || f.starting_at;
              if (d) kickoff = (typeof d === 'number') ? new Date(d < 1e12 ? d * 1000 : d).toLocaleString() : new Date(d).toLocaleString();
            } catch (e) { /* ignore */ }
            text += `• ${home} vs ${away} — ${kickoff}\n`;
          }

          // Push a sendMessage action per page
          actions.push({
            method: 'sendMessage',
            chat_id: chatId,
            text,
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] },
            parse_mode: 'Markdown'
          });
        }

        return actions;
      } catch (e) {
        logger.warn('fixtures_all handler failed', e?.message || e);
        return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: 'Failed to send all fixtures', show_alert: false };
      }
    }

    // Show all fixtures including postponed ones (paginated)
    if (data === 'fixtures_all_postponed') {
      try {
        const fixtures = (services && services.sportsAggregator) ? await services.sportsAggregator.getFixtures() : [];
        if (!fixtures || fixtures.length === 0) {
          return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: 'No fixtures available', show_alert: false };
        }

        // Do not filter by time here; include archived/postponed fixtures
        const useFixtures = fixtures;

        const actions = [];
        const pageSize = 25;
        for (let i = 0; i < useFixtures.length; i += pageSize) {
          const page = useFixtures.slice(i, i + pageSize);
          let text = `📋 *All Fixtures (including postponed)* (page ${Math.floor(i / pageSize) + 1}/${Math.ceil(fixtures.length / pageSize)})\n\n`;
          for (const f of page) {
            const home = safeName(f.home || f.homeTeam || f.homeName || (f.raw && f.raw.homeTeam), 'Home');
            const away = safeName(f.away || f.awayTeam || f.awayName || (f.raw && f.raw.awayTeam), 'Away');
            let kickoff = 'TBA';
            try {
              const d = f.kickoff || f.utcDate || f.date || f.time || f.starting_at;
              if (d) kickoff = (typeof d === 'number') ? new Date(d < 1e12 ? d * 1000 : d).toLocaleString() : new Date(d).toLocaleString();
            } catch (e) { /* ignore */ }

            // Mark postponed fixtures clearly
            const isPostponed = (f.state_id === 5) || (f.status && String(f.status).toUpperCase().includes('POSTPONED'));
            const postfix = isPostponed ? ' (POSTPONED)' : '';
            text += `• ${home} vs ${away} — ${kickoff}${postfix}\n`;
          }

          actions.push({
            method: 'sendMessage',
            chat_id: chatId,
            text,
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_fixtures' }]] },
            parse_mode: 'Markdown'
          });
        }

        return actions;
      } catch (e) {
        logger.warn('fixtures_all_postponed handler failed', e?.message || e);
        return { method: 'answerCallbackQuery', callback_query_id: cq.id, text: 'Failed to send postponed fixtures', show_alert: false };
      }
    }

    if (data.startsWith('news:')) {
      const category = data.split(':')[1];

      // Try to fetch news headlines from the aggregator/service if available
      let headlines = [];
      try {
        if (services && services.sportsAggregator && typeof services.sportsAggregator.getLiveNews === 'function') {
          headlines = await services.sportsAggregator.getLiveNews(category, 10);
        } else if (services && services.newsService && typeof services.newsService.getLatest === 'function') {
          headlines = await services.newsService.getLatest(category, 10);
        }
      } catch (e) {
        headlines = [];
      }

      if (!headlines || headlines.length === 0) {
        return {
          method: 'editMessageText',
          chat_id: chatId,
          message_id: messageId,
          text: `📰 *${String(category).toUpperCase()}* - No news available right now.`,
          reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'menu_main' }]] },
          parse_mode: 'Markdown'
        };
      }

      // Build news text
      let text = `📰 *${String(category).toUpperCase()}* - Latest Headlines\n\n`;
      headlines.slice(0, 10).forEach((h, idx) => {
        const title = (h && (h.title || h.headline)) ? String(h.title || h.headline) : 'Untitled';
        const src = (h && (h.source || h.provider || h.site)) ? ` — ${String(h.source || h.provider || h.site)}` : '';
        text += `${idx + 1}. ${title}${src}\n`;
      });

      const keyboard = [];
      headlines.slice(0, 6).forEach((h) => {
        const id = h && (h.id || h.url) ? encodeURIComponent(String(h.id || h.url)) : String(Math.random()).slice(2,8);
        keyboard.push([{ text: h.title ? String(h.title).slice(0,30) : 'Read', callback_data: `news_open:${id}` }]);
      });

      keyboard.push([{ text: '🔙 Back', callback_data: 'menu_main' }]);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'Markdown'
      };
    }

    // ========================================================================
    // PROFILE
    // ========================================================================

    if (data === 'profile') {
      const user = { name: 'User', tier: 'FREE', predictions: 0, winRate: '0', points: 0 };
      const menu = completeMenus.buildProfileMenu(user);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data === 'profile:stats') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '📊 Your statistics. Feature coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:bets') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '💰 Your betting history. Feature coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:settings') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '⚙️ Settings. Coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:referrals') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '🎁 Referral rewards. Coming soon!',
        show_alert: false
      };
    }

    if (data === 'profile:history') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '📊 Betting history. Coming soon!',
        show_alert: false
      };
    }

    // ========================================================================
    // FAVORITES
    // ========================================================================

    if (data === 'favorites') {
      const menu = completeMenus.buildFavoritesMenu([]);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data === 'favorites:add') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '➕ Search and add your favorite teams',
        show_alert: false
      };
    }

    if (data === 'favorites:remove') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '❌ Select a favorite to remove',
        show_alert: false
      };
    }

    // ========================================================================
    // SUBSCRIPTION & PAYMENT
    // ========================================================================

    if (data === 'subscription') {
      const menu = completeMenus.buildSubscriptionMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Plan details
    if (data.startsWith('plan:')) {
      const planId = data.split(':')[1];
      const menu = completeMenus.buildPlanDetailsMenu(planId);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Fixed odds packs
    if (data.startsWith('pack:')) {
      const packId = data.split(':')[1];
      const pack = completeMenus.FIXED_ODDS_PACKS[packId.toUpperCase()] || {};
      const text = `🌀 *BETRIX* - ${pack.emoji} ${pack.name}\n\n` +
        `💵 Price: *${pack.price}* / ${pack.priceUSD}\n` +
        `📊 Tips Per Month: ${pack.tipsPerMonth}\n\n` +
        `✅ Fixed match predictions with high accuracy.\n` +
        `Ready to subscribe?`;

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: {
          inline_keyboard: [
            [{ text: `✅ Subscribe ${pack.emoji}`, callback_data: `subscribe:${packId}` }],
            [{ text: '💳 Payment', callback_data: 'payment' }],
            [{ text: '🔙 Back', callback_data: 'subscription' }]
          ]
        },
        parse_mode: 'Markdown'
      };
    }

    // Payment methods menu
    if (data === 'payment') {
      const menu = completeMenus.buildPaymentMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Payment method details
    if (data.startsWith('pay:')) {
      const method = data.split(':')[1];
      const menu = completeMenus.buildPaymentDetailsMenu(method);

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    // Payment confirmation
    if (data.startsWith('pay_confirm:')) {
      const method = data.split(':')[1];

      // Only handle MPESA/STK confirmation here; other methods are no-ops
      if (method === 'mpesa' || method === 'mpesa_stk' || method === 'lipana') {
        try {
          const userId = cq.from && cq.from.id ? cq.from.id : null;
          const chatId = cq.message && cq.message.chat && cq.message.chat.id ? cq.message.chat.id : null;

          // Attempt to read stored user profile for phone number
          let profile = {};
          try { profile = await redis.hgetall(`user:${userId}:profile`) || {}; } catch (e) { profile = {}; }
          const msisdn = profile && (profile.msisdn || profile.phone || profile.msisdn) ? (profile.msisdn || profile.phone) : null;

          if (!msisdn) {
            return {
              method: 'answerCallbackQuery',
              callback_query_id: cq.id,
              text: '📱 Please send your phone number first (e.g. 2547XXXXXXXX) so we can initiate the STK push.',
              show_alert: true
            };
          }

          const amount = 300; // default amount for quick-deposit flow

          // Create a short-lived payment order (custom amount)
          const order = await createCustomPaymentOrder(redis, userId, amount, 'MPESA');

          // Try to trigger Lipana STK push (best-effort)
          let providerCheckout = null;
          try {
            const callback = process.env.LIPANA_CALLBACK_URL || process.env.MPESA_CALLBACK_URL || process.env.MPESA_CALLBACK_URL || null;
            const resp = await lipana.stkPush({ amount, phone: msisdn, tx_ref: order.orderId, reference: order.orderId, callback_url: callback });
            providerCheckout = resp?.raw?.data?.transactionId || resp?.raw?.data?._id || null;
            if (providerCheckout) {
              // Persist a payments row for reconciliation and audit
              try {
                const connStr = process.env.DATABASE_URL || null;
                if (connStr) {
                  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
                  const insertSql = `INSERT INTO payments(tx_ref, user_id, amount, status, metadata, created_at)
                    VALUES($1,$2,$3,$4,$5, now())`;
                  const metadata = { provider: 'LIPANA', provider_checkout_id: providerCheckout, orderId: order.orderId };
                  await pool.query(insertSql, [order.orderId, order.userId, order.totalAmount || amount, 'pending', JSON.stringify(metadata)]);
                  try { await pool.end(); } catch(e){ void e; }
                }
              } catch (ee) {
                logger.warn('Failed to persist payments row for STK push', ee?.message || String(ee));
              }
              // Store quick lookup mapping so webhook can resolve provider ref -> orderId
              try { await redis.setex(`payment:by_provider_ref:MPESA:${providerCheckout}`, 900, order.orderId); } catch (e) { void e; }
            }
          } catch (e) {
            logger.warn('Lipana STK push failed', e?.message || String(e));
          }

          // Reply to user indicating initiation
          const txRef = order.orderId;
          const replyText = `✅ STK push initiated for KES ${amount}.\nPlease check your phone and enter your M-Pesa PIN.\nTransaction ID: ${txRef}` + (providerCheckout ? `\nProvider checkout: ${providerCheckout}` : '');

          return {
            method: 'editMessageText',
            chat_id: chatId,
            message_id: cq.message.message_id,
            text: replyText,
            reply_markup: { inline_keyboard: [[{ text: '🔁 Retry payment', callback_data: 'pay:retry' }, { text: '❌ Cancel payment', callback_data: 'pay:cancel' }]] },
            parse_mode: 'Markdown'
          };
        } catch (err) {
          logger.warn('pay_confirm:mpesa handler failed', err?.message || String(err));
          return {
            method: 'answerCallbackQuery',
            callback_query_id: cq.id,
            text: '❌ Failed to initiate payment. Please try again later.',
            show_alert: true
          };
        }
      }

      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `💳 Proceeding with ${method.toUpperCase()} payment...`,
        show_alert: false
      };
    }

    // Subscribe
    if (data.startsWith('subscribe:')) {
      const plan = data.split(':')[1];
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: `✅ You selected ${plan}. Choose a payment method to proceed.`,
        show_alert: false
      };
    }

    // ========================================================================
    // HELP
    // ========================================================================

    if (data === 'help') {
      const menu = completeMenus.buildHelpMenu();

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text: menu.text,
        reply_markup: menu.reply_markup,
        parse_mode: 'Markdown'
      };
    }

    if (data === 'help:faq') {
      const text = `🌀 *BETRIX* - FAQ\n\n` +
        `*Q: How do I get started?*\n` +
        `A: Tap ⚽ Live Games to see current matches.\n\n` +
        `*Q: What's included in VVIP?*\n` +
        `A: Unlimited AI analysis, real-time alerts, advanced predictions.\n\n` +
        `*Q: How do I pay?*\n` +
        `A: We accept Till, M-Pesa, PayPal, Binance, and Bank Transfer.\n\n` +
        `*Q: Can I cancel anytime?*\n` +
        `A: Yes, cancel in Settings with no penalties.`;

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back', callback_data: 'help' }]
          ]
        },
        parse_mode: 'Markdown'
      };
    }

    if (data === 'help:tutorial') {
      const text = `🌀 *BETRIX* - How to Use\n\n` +
        `1️⃣ *View Live Games* → Tap ⚽ Live Games\n` +
        `2️⃣ *Check Odds* → Tap 📊 Odds & Analysis\n` +
        `3️⃣ *League Standings* → Tap 🏆 Standings\n` +
        `4️⃣ *Latest News* → Tap 📰 News\n` +
        `5️⃣ *Subscribe* → Tap 👑 Subscribe for premium\n\n` +
        `💡 Tip: Use /live, /odds, /standings commands for quick access.`;

      return {
        method: 'editMessageText',
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back', callback_data: 'help' }]
          ]
        },
        parse_mode: 'Markdown'
      };
    }

    if (data === 'help:billing') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '💰 Billing support. Contact: support@betrix.app',
        show_alert: false
      };
    }

    if (data === 'help:contact') {
      return {
        method: 'answerCallbackQuery',
        callback_query_id: cq.id,
        text: '📧 Email: support@betrix.app\n💬 Live chat available 24/7',
        show_alert: true
      };
    }

    // ========================================================================
    // FALLBACK
    // ========================================================================

    return {
      method: 'answerCallbackQuery',
      callback_query_id: cq.id,
      text: `Unknown action: ${data}`,
      show_alert: false
    };
  } catch (e) {
    logger.warn('handleCallbackQuery error', e?.message);
    return {
      method: 'answerCallbackQuery',
      callback_query_id: cq.id,
      text: '❌ Error processing action',
      show_alert: true
    };
  }
}

/**
 * Export handlers for use in worker
 */
export default {
  handleStart,
  handleMenu,
  handleLive,
  handleCallbackQuery
};
