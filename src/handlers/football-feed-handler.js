/**
 * Football Feed Handler
 * Live matches, fixtures, and match analysis with callback routing
 */

import { Logger } from '../utils/logger.js';
import FootballAggregator from './football-aggregator.js';

const logger = new Logger('FootballFeedHandler');

/**
 * Build live matches menu
 */
export async function buildLiveMatchesMenu(redis, page = 1) {
  const pageSize = 5;
  const aggregator = new FootballAggregator(redis);
  
  try {
    const matches = await aggregator.getLiveMatches();
    
    if (!matches || matches.length === 0) {
      return {
        text: `🌀 *BETRIX* - Live Matches\n\n⚠️ *No live matches at the moment.*\n\nCheck back soon for exciting fixtures! ⚽`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 View Fixtures', callback_data: 'football_fixtures' }],
            [{ text: '🔙 Back to Menu', callback_data: 'menu_main' }]
          ]
        }
      };
    }

    // Pagination
    const totalPages = Math.ceil(matches.length / pageSize);
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageMatches = matches.slice(start, start + pageSize);

    // Build text with match list
    let text = `🌀 *BETRIX* - Live Matches\n\n🟢 *LIVE NOW* (${matches.length} total)\n\n`;
    pageMatches.forEach((match, idx) => {
      const num = start + idx + 1;
      const score = match.homeScore !== undefined ? `${match.homeScore}-${match.awayScore}` : 'TBA';
      text += `${num}. *${match.home}* ${score} *${match.away}*\n`;
      text += `   🏟 ${match.league} | ⏱ ${match.status}\n`;
      if (match.minute) text += `   ⏳ Min ${match.minute}\n`;
      text += `\n`;
    });

    text += `_Powered by SportMonks Real-Time Data_`;

    // Build keyboard with match buttons + navigation
    const keyboard = [];
    pageMatches.forEach((match) => {
      keyboard.push([
        { text: `⚽ ${match.home} vs ${match.away}`, callback_data: `football_match:${match.id}:live` }
      ]);
    });

    // Navigation row
    const navRow = [];
    if (currentPage > 1) {
      navRow.push({ text: '◀ Prev', callback_data: `football_live:${currentPage - 1}` });
    }
    navRow.push({ text: '🔄 Refresh', callback_data: `football_live:${currentPage}` });
    if (currentPage < totalPages) {
      navRow.push({ text: 'Next ▶', callback_data: `football_live:${currentPage + 1}` });
    }
    if (navRow.length > 0) keyboard.push(navRow);

    // Bottom navigation
    keyboard.push([
      { text: '📅 Fixtures', callback_data: 'football_fixtures' },
      { text: '🔙 Menu', callback_data: 'menu_main' }
    ]);

    return {
      text,
      reply_markup: { inline_keyboard: keyboard }
    };
  } catch (e) {
    logger.warn('buildLiveMatchesMenu error', e?.message);
    return {
      text: `🌀 *BETRIX* - Live Matches\n\n❌ Error loading live matches. Try again.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Retry', callback_data: 'football_live:1' }],
          [{ text: '🔙 Back', callback_data: 'menu_main' }]
        ]
      }
    };
  }
}

/**
 * Build fixtures menu
 */
export async function buildFixturesMenu(redis, page = 1) {
  const pageSize = 5;
  const aggregator = new FootballAggregator(redis);
  
  try {
    const fixtures = await aggregator.getFixtures();
    
    if (!fixtures || fixtures.length === 0) {
      return {
        text: `🌀 *BETRIX* - Upcoming Fixtures\n\n⚠️ *No upcoming fixtures in the next 7 days.*`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚽ View Live', callback_data: 'football_live:1' }],
            [{ text: '🔙 Back to Menu', callback_data: 'menu_main' }]
          ]
        }
      };
    }

    // Pagination
    const totalPages = Math.ceil(fixtures.length / pageSize);
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageFixtures = fixtures.slice(start, start + pageSize);

    // Build text with fixture list
    let text = `🌀 *BETRIX* - Upcoming Fixtures\n\n📅 *NEXT 7 DAYS* (${fixtures.length} total)\n\n`;
    pageFixtures.forEach((fixture, idx) => {
      const num = start + idx + 1;
      const kickoffDate = new Date(fixture.kickoff);
      const timeStr = kickoffDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      text += `${num}. *${fixture.home}* vs *${fixture.away}*\n`;
      text += `   📅 ${timeStr} UTC | 🏟 ${fixture.league}\n`;
      text += `\n`;
    });

    text += `_Powered by Football-Data.org_`;

    // Build keyboard with fixture buttons + navigation
    const keyboard = [];
    pageFixtures.forEach((fixture) => {
      keyboard.push([
        { text: `📅 ${fixture.home} vs ${fixture.away}`, callback_data: `football_match:${fixture.id}:fixture` }
      ]);
    });

    // Navigation row
    const navRow = [];
    if (currentPage > 1) {
      navRow.push({ text: '◀ Prev', callback_data: `football_fixtures:${currentPage - 1}` });
    }
    navRow.push({ text: '🔄 Refresh', callback_data: `football_fixtures:${currentPage}` });
    if (currentPage < totalPages) {
      navRow.push({ text: 'Next ▶', callback_data: `football_fixtures:${currentPage + 1}` });
    }
    if (navRow.length > 0) keyboard.push(navRow);

    // Bottom navigation
    keyboard.push([
      { text: '⚽ Live Matches', callback_data: 'football_live:1' },
      { text: '🔙 Menu', callback_data: 'menu_main' }
    ]);

    return {
      text,
      reply_markup: { inline_keyboard: keyboard }
    };
  } catch (e) {
    logger.warn('buildFixturesMenu error', e?.message);
    return {
      text: `🌀 *BETRIX* - Upcoming Fixtures\n\n❌ Error loading fixtures. Try again.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Retry', callback_data: 'football_fixtures:1' }],
          [{ text: '🔙 Back', callback_data: 'menu_main' }]
        ]
      }
    };
  }
}

/**
 * Build match analysis menu
 */
export async function buildMatchAnalysisMenu(matchId, isLive = true, redis) {
  const aggregator = new FootballAggregator(redis);
  
  try {
    const analysis = await aggregator.getMatchAnalysis(matchId, isLive);
    
    if (!analysis) {
      return {
        text: `🌀 *BETRIX* - Match Analysis\n\n❌ *Match not found.*`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back', callback_data: isLive ? 'football_live:1' : 'football_fixtures:1' }]
          ]
        }
      };
    }

    const text = aggregator.formatAnalysis(analysis);

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Full Stats', callback_data: `football_stats:${matchId}` }],
          [{ text: '⬅️ Back', callback_data: isLive ? 'football_live:1' : 'football_fixtures:1' }]
        ]
      }
    };
  } catch (e) {
    logger.warn('buildMatchAnalysisMenu error', e?.message);
    return {
      text: `🌀 *BETRIX* - Match Analysis\n\n❌ Error loading match analysis.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Back', callback_data: isLive ? 'football_live:1' : 'football_fixtures:1' }]
        ]
      }
    };
  }
}

/**
 * Handle all football feed callbacks
 */
export async function handleFootballCallback(data, redis) {
  logger.info(`Football callback: ${data}`);

  // Football live matches
  if (data === 'football_live:1' || data.startsWith('football_live:')) {
    const page = parseInt(data.split(':')[1], 10) || 1;
    return await buildLiveMatchesMenu(redis, page);
  }

  // Football fixtures
  if (data === 'football_fixtures' || data.startsWith('football_fixtures:')) {
    const page = parseInt(data.split(':')[1], 10) || 1;
    return await buildFixturesMenu(redis, page);
  }

  // Football match analysis
  if (data.startsWith('football_match:')) {
    const parts = data.split(':');
    const matchId = parts[1];
    const type = parts[2] || 'live';
    const isLive = type === 'live';
    return await buildMatchAnalysisMenu(matchId, isLive, redis);
  }

  // Football match stats (stub)
  if (data.startsWith('football_stats:')) {
    const matchId = data.split(':')[1];
    return {
      text: `📊 *Match Stats*\n\nDetailed statistics for match ${matchId}.\n\n_Coming soon: full team stats, player performance, possession, shots, etc._`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Back', callback_data: `football_match:${matchId}:live` }]
        ]
      }
    };
  }

  return null;
}

export default {
  buildLiveMatchesMenu,
  buildFixturesMenu,
  buildMatchAnalysisMenu,
  handleFootballCallback
};
