/**
 * Natural Language Parser - Converts user queries to commands
 * Supports natural language like "which games are live?" and "show me free odds"
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('NLParser');

// Intent detection patterns (lowercase)
const intents = {
  live: [
    /live|now|current|happening|playing|today|match|game|fixture/i
  ],
  odds: [
    /odds|betting|bet|prediction|predict|analyze|analysis|forecast|line/i,
    /price|payout|return|stake|value|edge/i
  ],
  standings: [
    /table|standing|rank|position|league|leader|leader board|top teams/i,
    /ladder|classification|points/i
  ],
  news: [
    /news|latest|update|recent|headline|breaking|report|story/i,
    /injury|transfer|match report|gossip/i
  ],
  profile: [
    /profile|stats|account|my|record|history|performance|win rate/i,
    /referral|bonus|points|tier|subscription|plan/i
  ],
  subscribe: [
    /subscribe|upgrade|premium|vvip|paid|buy|plan|tier|membership/i,
    /payment|credit|card|price|cost/i
  ],
  help: [
    /help|guide|tutorial|how|faq|support|question|unclear/i
  ]
};

// Sport detection
const sports = {
  football: ['football', 'soccer', 'epl', 'premier', 'bundesliga', 'laliga', 'serie a', 'ligue 1'],
  basketball: ['basketball', 'nba', 'euroleague', 'aba'],
  tennis: ['tennis', 'atp', 'wta', 'grand slam', 'wimbledon', 'us open', 'french open', 'australian open'],
  cricket: ['cricket', 'ipl', 'test', 'odi', 't20', 'bpl'],
  nfl: ['nfl', 'american football', 'super bowl'],
  hockey: ['hockey', 'nhl', 'ice hockey'],
  baseball: ['baseball', 'mlb'],
  rugby: ['rugby', 'super rugby', 'premiership']
};

/**
 * Parse user message and extract intent + entities
 */
export function parseMessage(text) {
  if (!text) return { intent: null, entities: {} };

  const lower = text.toLowerCase().trim();

  // Detect intent
  let intent = null;
  for (const [key, patterns] of Object.entries(intents)) {
    if (patterns.some(p => p.test(lower))) {
      intent = key;
      break;
    }
  }

  // Detect sport
  let sport = null;
  for (const [key, keywords] of Object.entries(sports)) {
    if (keywords.some(k => lower.includes(k))) {
      sport = key;
      break;
    }
  }

  // Detect team names (simple approach - capitalized words)
  const teamMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g) || [];
  const teams = teamMatch.filter(t => !['The', 'Vs', 'And'].includes(t));

  // Detect free/paid preference
  const isFree = /free|no cost|without/.test(lower);
  const isPaid = /premium|vvip|paid/.test(lower);

  return {
    intent,
    sport,
    teams,
    isFree,
    isPaid,
    fullText: text,
    original: lower
  };
}

/**
 * Convert parsed intent to command
 */
export function intentToCommand(intent) {
  const commands = {
    live: '/live',
    odds: '/odds',
    standings: '/standings',
    news: '/news',
    profile: '/profile',
    subscribe: '/vvip',
    help: '/help'
  };

  return commands[intent] || null;
}

/**
 * Generate response suggestion based on query
 */
export function suggestResponse(parsed) {
  const { intent, sport, isFree, teams } = parsed;

  // Free users get limited responses
  if (isFree) {
    return {
      type: 'limited',
      message: 'This detailed analysis is available with BETRIX VVIP. Upgrade now for unlimited insights!'
    };
  }

  // Build response context
  let context = {
    sport: sport || 'all',
    teams: teams.length > 0 ? teams : null,
    intent: intent || 'explore'
  };

  return {
    type: 'full',
    context,
    intent
  };
}

/**
 * Extract specific queries
 */
export function extractQuery(parsed) {
  const { original, teams, sport } = parsed;

  // "Live games" or "Live football" or "Live Liverpool vs Man City"
  if (parsed.intent === 'live') {
    return {
      type: 'live_games',
      sport: sport || 'all',
      teams: teams.length > 0 ? teams[0] : null // first team mentioned
    };
  }

  // "Free odds" or "Best odds" or "Liverpool odds"
  if (parsed.intent === 'odds') {
    return {
      type: 'odds',
      sport: sport || 'all',
      team: teams.length > 0 ? teams[0] : null,
      isFree: parsed.isFree
    };
  }

  // "Premier League standings" or "EPL table"
  if (parsed.intent === 'standings') {
    return {
      type: 'standings',
      league: sport || original.match(/\b(epl|bundesliga|laliga|serie.?a|ligue.?1)\b/i)?.[0] || 'all'
    };
  }

  // "Latest news" or "Transfer news"
  if (parsed.intent === 'news') {
    return {
      type: 'news',
      category: original.includes('transfer') ? 'transfer' : 'general',
      sport: sport || 'all'
    };
  }

  // "My profile" or "My stats"
  if (parsed.intent === 'profile') {
    return {
      type: 'profile'
    };
  }

  // "Upgrade" or "VVIP" or "Subscribe"
  if (parsed.intent === 'subscribe') {
    return {
      type: 'upgrade'
    };
  }

  return {
    type: 'help',
    text: original
  };
}

/**
 * Validate and format query for API calls
 */
export function formatQuery(query) {
  return {
    ...query,
    timestamp: Date.now()
  };
}

export default {
  parseMessage,
  intentToCommand,
  suggestResponse,
  extractQuery,
  formatQuery
};
