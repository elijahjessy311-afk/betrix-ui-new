/**
 * Enhanced Multi-Sport Command Handler
 * Handles /analyze command with support for multiple sports and betting markets
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('MultiSportHandler');

export async function handleMultiSportAnalyze(chatId, userId, query, redis, services) {
  try {
    if (!services.multiSportAnalyzer) {
      return {
        chat_id: chatId,
        text: '❌ Multi-sport analyzer not available. Try /odds instead.',
        parse_mode: 'Markdown'
      };
    }

    // Parse query: "/analyze [sport] [team1] vs [team2] [market]"
    // Examples:
    // /analyze football "Man Utd" vs "Liverpool"
    // /analyze basketball "Lakers" vs "Celtics" spread
    // /analyze tennis "Federer" vs "Nadal" moneyline
    // /analyze cricket "India" vs "Pakistan" runs_spread

    const parts = query.trim().split(/\s+vs\s+|\s+vs\s+/i);
    if (parts.length < 2) {
      return formatSportsGuide(services.multiSportAnalyzer);
    }

    const firstPart = parts[0].trim();
    const secondPart = parts.slice(1).join(' vs ').trim();

    // Extract sport and teams
    const sportMatch = firstPart.match(/^(\w+)\s+"?([^"]+)"?$/i);
    if (!sportMatch) {
      return formatSportsGuide(services.multiSportAnalyzer);
    }

    const sport = sportMatch[1];
    const homeTeam = sportMatch[2];

    // Extract away team and optional market
    const awayMatch = secondPart.match(/^"?([^"]+)"?\s*(.*)$/i);
    if (!awayMatch) {
      return formatSportsGuide(services.multiSportAnalyzer);
    }

    const awayTeam = awayMatch[1];
    let betMarket = awayMatch[2] ? awayMatch[2].trim().toUpperCase() : null;

    logger.info('Multi-sport analysis request', { sport, homeTeam, awayTeam, betMarket });

    // Perform analysis
    const analysis = await services.multiSportAnalyzer.analyzeMatch(
      sport,
      homeTeam,
      awayTeam,
      null, // leagueId
      betMarket
    );

    if (analysis.status === 'error') {
      return {
        chat_id: chatId,
        text: `❌ ${analysis.message}`,
        parse_mode: 'Markdown'
      };
    }

    // Format response
    const formatted = services.multiSportAnalyzer.formatForTelegram(analysis);

    return {
      chat_id: chatId,
      text: formatted,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Other Markets', callback_data: `analyze_markets_${sport}_${homeTeam}_${awayTeam}` },
            { text: '🔄 Refresh', callback_data: `analyze_refresh_${sport}_${homeTeam}_${awayTeam}` }
          ],
          [{ text: '⬅️ Back to Menu', callback_data: 'menu_main' }]
        ]
      }
    };
  } catch (err) {
    logger.error('handleMultiSportAnalyze failed', err);
    return {
      chat_id: chatId,
      text: '❌ Analysis failed. Please try again.',
      parse_mode: 'Markdown'
    };
  }
}

/**
 * Format sports guide
 */
function formatSportsGuide(multiSportAnalyzer) {
  const guide = multiSportAnalyzer.getAllSportsOverview();
  
  return {
    chat_id: 0, // Will be set by handler
    text: guide +
          `\n*HOW TO USE:*\n` +
          `📌 /analyze football "Man Utd" vs "Liverpool"\n` +
          `📌 /analyze football "Man Utd" vs "Liverpool" over_2.5\n` +
          `📌 /analyze basketball "Lakers" vs "Celtics" spread\n` +
          `📌 /analyze tennis "Federer" vs "Nadal"\n` +
          `📌 /analyze cricket "India" vs "Pakistan" runs_spread\n\n` +
          `*Available Markets:*\n` +
          `🔷 Football: 1X2, OVER_UNDER, CORNERS, CARDS, BOTH_SCORE, FIRST_GOAL\n` +
          `🔷 Basketball: MONEYLINE, SPREAD, TOTAL_POINTS, HALFTIME\n` +
          `🔷 Tennis: MONEYLINE, SET_SPREAD, GAME_SPREAD\n` +
          `🔷 Cricket: MONEYLINE, RUNS_SPREAD, WICKETS, MAIDEN_OVERS\n` +
          `🔷 American Football: MONEYLINE, SPREAD, TOTAL_POINTS, TOUCHDOWN\n` +
          `🔷 Hockey: MONEYLINE, PUCK_LINE, TOTAL_GOALS, POWER_PLAY`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ Back', callback_data: 'menu_main' }]
      ]
    }
  };
}

/**
 * Handle market selection callback
 */
export async function handleMarketSelection(callbackData, chatId, userId, redis, services) {
  try {
    const match = callbackData.match(/^analyze_markets_(.+)_(.+)_(.+)$/);
    if (!match) return null;

    const [_, sport, homeTeam, awayTeam] = match;

    const analysis = await services.multiSportAnalyzer.analyzeMatch(
      sport,
      homeTeam,
      awayTeam
    );

    if (analysis.status === 'error') {
      return {
        chat_id: chatId,
        text: `❌ ${analysis.message}`,
        parse_mode: 'Markdown'
      };
    }

    // Show alternative markets in inline buttons
    let text = `${analysis.sportIcon} *Available Markets for ${analysis.match}*\n\n`;
    
    analysis.alternativeMarkets.forEach((market, idx) => {
      text += `${idx + 1}. *${market.market}*\n`;
      text += `   Prediction: ${market.prediction?.outcome}\n`;
      text += `   Confidence: ${market.confidence}%\n`;
      text += `   Odds: ${market.prediction?.odds}\n\n`;
    });

    return {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    };
  } catch (err) {
    logger.error('handleMarketSelection failed', err);
    return null;
  }
}

/**
 * Get market-specific analysis
 */
export async function getMarketAnalysis(sport, homeTeam, awayTeam, market, services) {
  try {
    const analysis = await services.multiSportAnalyzer.analyzeMatch(
      sport,
      homeTeam,
      awayTeam,
      null,
      market
    );

    if (analysis.status === 'error') {
      return null;
    }

    const primaryMarket = analysis.primaryMarket;
    if (!primaryMarket) {
      return null;
    }

    return {
      market: primaryMarket.market,
      prediction: primaryMarket.prediction?.outcome,
      confidence: primaryMarket.confidence,
      odds: primaryMarket.prediction?.odds,
      reasoning: primaryMarket.reasoning
    };
  } catch (err) {
    logger.error('getMarketAnalysis failed', err);
    return null;
  }
}
