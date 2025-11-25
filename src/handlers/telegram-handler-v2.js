/**
 * Telegram Handler - Main message and callback query handler
 * Integrates menus, NLP, commands, and payment system
 */

import { Logger } from '../utils/logger.js';
import {
  mainMenu,
  sportsMenu,
  subscriptionMenu,
  profileMenu,
  helpMenu,
  formatLiveGames,
  formatOdds,
  formatStandings,
  formatProfile,
  formatNews,
  formatNaturalResponse,
  formatUpgradePrompt
} from './menu-handler.js';
import {
  parseMessage,
  intentToCommand,
  extractQuery
} from './nl-parser.js';
import {
  getUserSubscription,
  canAccessFeature,
  formatSubscriptionDetails,
  TIERS
} from './payment-handler.js';

const logger = new Logger('TelegramHandler');

/**
 * Handle incoming Telegram message
 */
export async function handleMessage(update, redis, services) {
  try {
    const message = update.message || update.edited_message;
    if (!message) return null;

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';

    // Store user session
    await redis.setex(`user:${userId}:last_seen`, 86400, Date.now());

    // Log message
    logger.info('Message received', { userId, chatId, text: text.substring(0, 50) });

    // Check if it's a command
    if (text.startsWith('/')) {
      return await handleCommand(text, chatId, userId, redis, services);
    }

    // Natural language processing
    return await handleNaturalLanguage(text, chatId, userId, redis, services);
  } catch (err) {
    logger.error('Message handling error', err);
    return null;
  }
}

/**
 * Handle slash commands
 */
async function handleCommand(text, chatId, userId, redis, services) {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
    case '/menu':
      return {
        chat_id: chatId,
        text: mainMenu.text,
        reply_markup: mainMenu.reply_markup,
        parse_mode: 'Markdown'
      };

    case '/live':
      return handleLiveGames(chatId, userId, redis, services);

    case '/odds':
      return handleOdds(chatId, userId, redis, services);

    case '/standings':
      return handleStandings(chatId, userId, redis, services);

    case '/news':
      return handleNews(chatId, userId, redis, services);

    case '/profile':
      return handleProfile(chatId, userId, redis, services);

    case '/vvip':
    case '/subscribe':
      return {
        chat_id: chatId,
        text: subscriptionMenu.text,
        reply_markup: subscriptionMenu.reply_markup,
        parse_mode: 'Markdown'
      };

    case '/help':
      return {
        chat_id: chatId,
        text: helpMenu.text,
        reply_markup: helpMenu.reply_markup,
        parse_mode: 'Markdown'
      };

    default:
      return {
        chat_id: chatId,
        text: `🌀 *BETRIX* - Command not recognized\n\nTry:\n/live - Live games\n/odds - Current odds\n/standings - League tables\n/news - Latest news\n/help - Full guide`,
        parse_mode: 'Markdown'
      };
  }
}

/**
 * Handle natural language queries
 */
async function handleNaturalLanguage(text, chatId, userId, redis, services) {
  try {
    // Parse user intent
    const parsed = parseMessage(text);

    if (!parsed.intent) {
      // Generic AI response
      return await handleGenericAI(text, chatId, userId, redis, services);
    }

    // Route by intent
    const query = extractQuery(parsed);

    switch (query.type) {
      case 'live_games':
        return await handleLiveGames(chatId, userId, redis, services, query);

      case 'odds':
        return await handleOdds(chatId, userId, redis, services, query);

      case 'standings':
        return await handleStandings(chatId, userId, redis, services, query);

      case 'news':
        return await handleNews(chatId, userId, redis, services, query);

      case 'profile':
        return await handleProfile(chatId, userId, redis, services);

      case 'upgrade':
        return {
          chat_id: chatId,
          text: subscriptionMenu.text,
          reply_markup: subscriptionMenu.reply_markup,
          parse_mode: 'Markdown'
        };

      default:
        return await handleGenericAI(text, chatId, userId, redis, services);
    }
  } catch (err) {
    logger.error('NLP handling error', err);
    return await handleGenericAI(text, chatId, userId, redis, services);
  }
}

/**
 * Handle live games request
 */
async function handleLiveGames(chatId, userId, redis, services, query = {}) {
  try {
    const { openLiga, rss } = services;

    // Get live matches from cache
    let games = [];
    if (openLiga) {
      try {
        const recent = await openLiga.getRecentMatches(query.sport || 'bl1', new Date().getFullYear(), 5);
        games = recent.slice(0, 5);
      } catch (e) {
        logger.warn('Failed to fetch live games', e);
      }
    }

    const response = formatLiveGames(games, query.sport || 'Football');

    return {
      chat_id: chatId,
      text: response,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Get Odds', callback_data: 'menu_odds' }],
          [{ text: '🔙 Main Menu', callback_data: 'menu_main' }]
        ]
      }
    };
  } catch (err) {
    logger.error('Live games handler error', err);
    return {
      chat_id: chatId,
      text: '🌀 *BETRIX* - Unable to fetch live games. Try again later.',
      parse_mode: 'Markdown'
    };
  }
}

/**
 * Handle odds request
 */
async function handleOdds(chatId, userId, redis, services, query = {}) {
  try {
    const subscription = await getUserSubscription(redis, userId);

    // Check tier access
    if (subscription.tier === 'FREE' && query.isFree === false) {
      return {
        chat_id: chatId,
        text: formatUpgradePrompt('Advanced odds analysis'),
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👑 Upgrade to VVIP', callback_data: 'sub_upgrade_vvip' }],
            [{ text: '🔙 Back', callback_data: 'menu_main' }]
          ]
        }
      };
    }

    // Fetch odds from services
    let matches = [];
    if (services.footballData) {
      try {
        const fixtures = await services.footballData.fixturesFromCsv('E0', '2425');
        matches = fixtures.slice(0, 8);
      } catch (e) {
        logger.warn('Failed to fetch odds', e);
      }
    }

    const response = formatOdds(matches);

    return {
      chat_id: chatId,
      text: response,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚽ Live Games', callback_data: 'menu_live' }],
          [{ text: '🔙 Main Menu', callback_data: 'menu_main' }]
        ]
      }
    };
  } catch (err) {
    logger.error('Odds handler error', err);
    return {
      chat_id: chatId,
      text: '🌀 *BETRIX* - Unable to fetch odds data.',
      parse_mode: 'Markdown'
    };
  }
}

/**
 * Handle standings request
 */
async function handleStandings(chatId, userId, redis, services, query = {}) {
  try {
    const { openLiga } = services;

    let standings = [];
    if (openLiga) {
      try {
        const league = query.league || 'BL1';
        standings = await openLiga.getStandings(league) || [];
      } catch (e) {
        logger.warn('Failed to fetch standings', e);
      }
    }

    const response = formatStandings(query.league || 'Premier League', standings);

    return {
      chat_id: chatId,
      text: response,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Odds', callback_data: 'menu_odds' }],
          [{ text: '🔙 Main Menu', callback_data: 'menu_main' }]
        ]
      }
    };
  } catch (err) {
    logger.error('Standings handler error', err);
    return {
      chat_id: chatId,
      text: '🌀 *BETRIX* - Unable to fetch standings.',
      parse_mode: 'Markdown'
    };
  }
}

/**
 * Handle news request
 */
async function handleNews(chatId, userId, redis, services, query = {}) {
  try {
    const { rss } = services;

    let articles = [];
    if (rss) {
      try {
        const feeds = [
          'https://feeds.bbci.co.uk/sport/football/rss.xml',
          'https://www.theguardian.com/football/rss'
        ];
        const result = await rss.fetchMultiple(feeds);
        articles = result.slice(0, 5);
      } catch (e) {
        logger.warn('Failed to fetch news', e);
      }
    }

    const response = formatNews(articles);

    return {
      chat_id: chatId,
      text: response,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚽ Live Games', callback_data: 'menu_live' }],
          [{ text: '🔙 Main Menu', callback_data: 'menu_main' }]
        ]
      }
    };
  } catch (err) {
    logger.error('News handler error', err);
    return {
      chat_id: chatId,
      text: '🌀 *BETRIX* - Unable to fetch news.',
      parse_mode: 'Markdown'
    };
  }
}

/**
 * Handle profile request
 */
async function handleProfile(chatId, userId, redis, services) {
  try {
    const user = await redis.hgetall(`user:${userId}`);
    const subscription = await getUserSubscription(redis, userId);

    const profileData = {
      name: user.name || 'BETRIX User',
      tier: subscription.tier,
      joinDate: user.joinDate || new Date().toLocaleDateString(),
      predictions: user.predictions || 0,
      winRate: user.winRate || 0,
      points: user.points || 0,
      referralCode: userId.toString(36).toUpperCase(),
      referrals: user.referrals || 0,
      bonusPoints: user.bonusPoints || 0,
      nextTier: subscription.tier === 'FREE' ? 'PRO' : 'VVIP'
    };

    const response = formatProfile(profileData);

    return {
      chat_id: chatId,
      text: response + `\n\n${formatSubscriptionDetails(subscription)}`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👑 Upgrade', callback_data: 'sub_upgrade_vvip' }],
          [{ text: '🔙 Main Menu', callback_data: 'menu_main' }]
        ]
      }
    };
  } catch (err) {
    logger.error('Profile handler error', err);
    return {
      chat_id: chatId,
      text: '🌀 *BETRIX* - Unable to load profile.',
      parse_mode: 'Markdown'
    };
  }
}

/**
 * Handle generic AI response
 */
async function handleGenericAI(text, chatId, userId, redis, services) {
  try {
    const { aiChain } = services;

    if (!aiChain) {
      return {
        chat_id: chatId,
        text: `🌀 *BETRIX* - Sorry, I couldn't understand that. Try:\n/live\n/odds\n/standings\n/news`,
        parse_mode: 'Markdown'
      };
    }

    // Get AI response
    const response = await aiChain.analyze({
      userId,
      query: text,
      context: 'sports_betting'
    });

    return {
      chat_id: chatId,
      text: formatNaturalResponse(response || 'Unable to analyze this request.'),
      parse_mode: 'Markdown'
    };
  } catch (err) {
    logger.error('AI handler error', err);
    return {
      chat_id: chatId,
      text: `🌀 *BETRIX* - ${err.message || 'Unable to process your request.'}`,
      parse_mode: 'Markdown'
    };
  }
}

/**
 * Handle callback queries (button clicks)
 */
export async function handleCallbackQuery(callbackQuery, redis, services) {
  try {
    const { id: cbId, from: { id: userId }, data } = callbackQuery;
    const chatId = callbackQuery.message.chat.id;

    logger.info('Callback query', { userId, data });

    // Route callback
    if (data.startsWith('menu_')) {
      return handleMenuCallback(data, chatId, userId, redis);
    }

    if (data.startsWith('sport_')) {
      return handleSportCallback(data, chatId, userId, redis);
    }

    if (data.startsWith('sub_')) {
      return handleSubscriptionCallback(data, chatId, userId, redis, services);
    }

    if (data.startsWith('profile_')) {
      return handleProfileCallback(data, chatId, userId, redis);
    }

    if (data.startsWith('help_')) {
      return handleHelpCallback(data, chatId, userId, redis);
    }

    // Acknowledge callback
    return {
      method: 'answerCallbackQuery',
      callback_query_id: cbId
    };
  } catch (err) {
    logger.error('Callback query error', err);
    return null;
  }
}

/**
 * Handle menu callbacks
 */
function handleMenuCallback(data, chatId, userId, redis) {
  const menuMap = {
    'menu_main': mainMenu,
    'menu_live': { text: 'Select a sport for live games:', reply_markup: sportsMenu.reply_markup },
    'menu_odds': { text: 'Loading odds...', reply_markup: sportsMenu.reply_markup },
    'menu_standings': { text: 'Select a league for standings:', reply_markup: sportsMenu.reply_markup },
    'menu_news': { text: 'Loading latest news...', reply_markup: mainMenu.reply_markup },
    'menu_profile': profileMenu,
    'menu_vvip': subscriptionMenu,
    'menu_help': helpMenu
  };

  const menu = menuMap[data];
  if (!menu) return null;

  return {
    method: 'editMessageText',
    chat_id: chatId,
    message_id: undefined,
    text: menu.text,
    reply_markup: menu.reply_markup,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle sport selection
 */
function handleSportCallback(data, chatId, userId, redis) {
  const sport = data.replace('sport_', '');
  return {
    method: 'editMessageText',
    chat_id: chatId,
    message_id: undefined,
    text: `Loading ${sport} data...`,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle subscription callbacks
 */
async function handleSubscriptionCallback(data, chatId, userId, redis, services) {
  if (data === 'sub_manage') {
    const subscription = await getUserSubscription(redis, userId);
    return {
      method: 'editMessageText',
      chat_id: chatId,
      message_id: undefined,
      text: `Your current subscription:\n\n${formatSubscriptionDetails(subscription)}`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back', callback_data: 'menu_vvip' }]
        ]
      }
    };
  }

  // Extract tier from data
  const tier = data.replace('sub_upgrade_', '').toUpperCase();

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `💳 Ready to upgrade to ${TIERS[tier].name}?\n\n$${TIERS[tier].price}/month\n\nClick Pay to continue.`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Proceed to Payment', callback_data: `pay_${tier}` }],
        [{ text: '🔙 Back', callback_data: 'menu_vvip' }]
      ]
    }
  };
}

/**
 * Handle profile callbacks
 */
function handleProfileCallback(data, chatId, userId, redis) {
  const responses = {
    'profile_stats': 'Your performance metrics',
    'profile_bets': 'Your betting history',
    'profile_favorites': 'Your favorite teams/leagues',
    'profile_settings': 'Account settings'
  };

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🌀 *BETRIX* - ${responses[data] || 'Coming soon'}`,
    parse_mode: 'Markdown'
  };
}

/**
 * Handle help callbacks
 */
function handleHelpCallback(data, chatId, userId, redis) {
  const responses = {
    'help_faq': '📚 Frequently Asked Questions\n\nQ: How accurate are predictions?\nA: Our AI model achieves 80-85% accuracy on selected matches.\n\nMore FAQs coming soon!',
    'help_demo': '🎮 Demo Mode\n\nTry our features with sample data!',
    'help_contact': '📧 Contact Support\n\nemail: support@betrix.app\n📱 Telegram: @betrix_support'
  };

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: responses[data] || 'Help section',
    parse_mode: 'Markdown'
  };
}

export default {
  handleMessage,
  handleCallbackQuery,
  handleCommand,
  handleNaturalLanguage
};
