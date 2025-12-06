/**
 * UI Builder - Beautiful Telegram UI with Icons and Menus
 * Subscription-aware responses and professional formatting
 */

import { escapeHtml } from "./formatters.js";

const EMOJIS = {
  // Status
  free: "🎁",
  member: "👤",
  vvip: "💎",
  locked: "🔒",
  
  // Navigation
  back: "⬅️",
  next: "▶️",
  prev: "◀️",
  home: "🏠",
  
  // Actions
  buy: "💳",
  watch: "👁️",
  analyze: "🔍",
  predict: "🎯",
  compare: "⚖️",
  
  // Odds
  home_team: "🏠",
  draw: "🤝",
  away_team: "🏁",
  total: "📊",
  margin: "📈",
  
  // Sections
  live: "🔴",
  standings: "📊",
  odds: "🎲",
  analysis: "🔍",
  predictions: "🧠",
  tips: "💡",
  alerts: "🔔",
  premium: "⭐",
  
  // Status
  available: "✅",
  unavailable: "❌",
  loading: "⏳",
  update: "🔄",
};

class UIBuilder {
  /**
   * Format odds beautifully for display
   */
  static formatOdds(oddData, tier = "free") {
    if (!oddData) return "No odds available";

    const bookmakers = oddData.bookmakers || [];
    if (!bookmakers.length) return "Odds data unavailable";

    const bets = bookmakers[0].bets || [];
    const mainBet = bets[0] || {};
    const values = mainBet.values || [];

    if (!values.length) return "Unable to load odds";

    const home = values[0]?.odd || "—";
    const draw = values[1]?.odd || "—";
    const away = values[2]?.odd || "—";

    let text = `${EMOJIS.odds} <b>Match Odds</b>\n\n`;
    text += `${EMOJIS.home_team} <b>Home:</b> ${escapeHtml(String(home))}\n`;
    text += `${EMOJIS.draw} <b>Draw:</b> ${escapeHtml(String(draw))}\n`;
    text += `${EMOJIS.away_team} <b>Away:</b> ${escapeHtml(String(away))}\n`;

    if (tier === "vvip") {
      text += `\n<b>Advanced Analysis (VVIP):</b>\n`;
      text += `📊 Implied Home: ${(100 / parseFloat(home)).toFixed(1)}%\n`;
      text += `📊 Implied Draw: ${(100 / parseFloat(draw)).toFixed(1)}%\n`;
      text += `📊 Implied Away: ${(100 / parseFloat(away)).toFixed(1)}%\n`;
      text += `💰 Vig: ${(((100 / parseFloat(home) + 100 / parseFloat(draw) + 100 / parseFloat(away)) - 100)).toFixed(1)}%`;
    } else if (tier === "member") {
      text += `\n💡 Upgrade to VVIP for advanced odds analysis`;
    }

    return text;
  }

  /**
   * Build keyboard based on subscription tier
   */
  static buildMainMenu(tier = "free") {
    const baseButtons = [
      [
        { text: `${EMOJIS.live} Live`, callback_data: "menu:live" },
        { text: `${EMOJIS.standings} Standings`, callback_data: "menu:standings" },
      ],
      [
        { text: `${EMOJIS.odds} Odds`, callback_data: "menu:odds" },
        { text: `${EMOJIS.tips} Tips`, callback_data: "menu:tips" },
      ],
    ];

    if (tier === "member") {
      baseButtons.push([
        { text: `${EMOJIS.analyze} Analysis`, callback_data: "menu:analysis" },
        { text: `${EMOJIS.predictions} Predictions`, callback_data: "menu:predict" },
      ]);
    } else if (tier === "vvip") {
      baseButtons.push([
        { text: `${EMOJIS.analyze} Analysis`, callback_data: "menu:analysis" },
        { text: `${EMOJIS.predictions} Predictions`, callback_data: "menu:predict" },
      ]);
      baseButtons.push([
        { text: `${EMOJIS.premium} Premium`, callback_data: "menu:premium" },
        { text: `${EMOJIS.alerts} Alerts`, callback_data: "menu:alerts" },
      ]);
    }

    baseButtons.push([
      { text: `${tier === "free" ? EMOJIS.buy : EMOJIS.member} Account`, callback_data: "menu:account" },
      { text: `🧭 Settings`, callback_data: "menu:settings" },
    ]);

    return { inline_keyboard: baseButtons };
  }

  /**
   * Format match for display
   */
  static formatMatch(match, tier = "free") {
    const home = escapeHtml(match.teams?.home?.name || "Home");
    const away = escapeHtml(match.teams?.away?.name || "Away");
    const date = new Date(match.fixture?.date);
    const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const dateStr = date.toLocaleDateString();

    let text = `${home} vs ${away}\n`;
    text += `⏰ ${dateStr} ${time}\n`;
    text += `📍 ${escapeHtml(match.fixture?.venue?.name || "TBD")}`;

    if (tier === "member" || tier === "vvip") {
      const h2h = match.teams?.home?.update || "";
      text += `\n\n📊 Form: ${h2h}`;
    }

    if (tier === "vvip") {
      text += `\n💎 <b>VVIP Content Available</b>`;
    }

    return text;
  }

  /**
   * Format standings beautifully
   */
  static formatStandings(standings, tier = "free") {
    if (!standings || !standings.length) return "No standings data";

    let text = `${EMOJIS.standings} <b>League Table</b>\n\n`;
    text += `<code>Pos Team                    Pts  GD\n`;
    text += `────────────────────────────────────\n`;

    standings.slice(0, tier === "vvip" ? 20 : 10).forEach((team) => {
      const pos = String(team.rank).padStart(2);
      const name = team.team?.name?.padEnd(20) || "";
      const pts = String(team.points).padStart(3);
      const gd = String(team.goalsDiff).padStart(3);
      text += `${pos} ${name} ${pts}  ${gd}\n`;
    });

    text += `</code>`;

    if (tier === "vvip") {
      text += `\n\n💎 <b>Full Table Available</b>`;
    } else {
      text += `\n\n💡 Upgrade to see full standings`;
    }

    return text;
  }

  /**
   * Format prediction with confidence
   */
  static formatPrediction(prediction, tier = "free") {
    let text = `${EMOJIS.predict} <b>Match Prediction</b>\n\n`;
    text += `${prediction.prediction}\n\n`;

    if (tier === "member") {
      text += `📊 Confidence: ${Math.round(prediction.confidence * 100)}%\n`;
    } else if (tier === "vvip") {
      text += `📊 Confidence: ${Math.round(prediction.confidence * 100)}%\n`;
      text += `📈 Expected Value: ${((prediction.confidence - 0.5) * 2 * 100).toFixed(1)}%\n`;
      text += `🎯 Recommended Unit: 1-2 units`;
    } else {
      text += `🔒 Confidence analysis available for members`;
    }

    return text;
  }

  /**
   * Build subscription upsell menu
   */
  static buildSubscriptionMenu() {
    return {
      inline_keyboard: [
        [
          { text: `${EMOJIS.member} Member (KES 150)`, callback_data: "sub:member" },
          { text: `${EMOJIS.vvip} VVIP (KES 200/day)`, callback_data: "sub:vvip_day" },
        ],
        [
          { text: `${EMOJIS.vvip} VVIP Weekly (KES 800)`, callback_data: "sub:vvip_week" },
          { text: `${EMOJIS.vvip} VVIP Monthly (KES 2500)`, callback_data: "sub:vvip_month" },
        ],
        [
          { text: `${EMOJIS.back} Back to Menu`, callback_data: "menu:main" },
        ],
      ],
    };
  }

  /**
   * Build features list with lock status
   */
  static buildFeaturesList(tier = "free") {
    const features = {
      live: { name: "Live Matches", tier: "free" },
      standings: { name: "League Standings", tier: "free" },
      odds: { name: "Betting Odds", tier: "free" },
      tips: { name: "Strategy Tips", tier: "free" },
      analysis: { name: "Match Analysis", tier: "member" },
      predictions: { name: "AI Predictions", tier: "member" },
      coach: { name: "Betting Coach", tier: "vvip" },
      dossier: { name: "Match Dossier", tier: "vvip" },
      trends: { name: "Seasonal Trends", tier: "vvip" },
      alerts: { name: "Live Alerts", tier: "vvip" },
    };

    let text = `${EMOJIS.premium} <b>Feature Access</b>\n\n`;
    text += `Your Tier: ${tier === "vvip" ? "💎 VVIP" : tier === "member" ? "👤 Member" : "🎁 Free"}\n\n`;

    for (const feature of Object.values(features)) {
      const tierLevels = { free: 0, member: 1, vvip: 2 };
      const hasAccess = tierLevels[tier] >= tierLevels[feature.tier];
      const icon = hasAccess ? EMOJIS.available : EMOJIS.locked;
      text += `${icon} ${feature.name}\n`;
    }

    if (tier === "free") {
      text += `\n💡 Upgrade to Member or VVIP to unlock more features`;
    }

    return text;
  }

  /**
   * Build payment methods menu
   */
  static buildPaymentMenu() {
    return {
      inline_keyboard: [
        [
          { text: "💳 PayPal", callback_data: "pay:paypal" },
          { text: "📱 M-Pesa", callback_data: "pay:mpesa" },
        ],
        [
          { text: "₿ Binance", callback_data: "pay:binance" },
          { text: "🏦 Bank Transfer", callback_data: "pay:bank" },
        ],
        [
          { text: `${EMOJIS.back} Back`, callback_data: "menu:main" },
        ],
      ],
    };
  }

  /**
   * Format premium dossier header
   */
  static formatDossierHeader(match, tier = "free") {
    if (tier !== "vvip") {
      return `${EMOJIS.locked} Professional match dossier available for VVIP members only`;
    }

    const text =
      `${EMOJIS.premium} <b>PROFESSIONAL MATCH DOSSIER</b>\n` +
      `═══════════════════════════════════\n\n` +
      `🏟️ ${escapeHtml(match.teams?.home?.name)} vs ${escapeHtml(match.teams?.away?.name)}\n` +
      `📅 ${new Date(match.fixture?.date).toLocaleDateString()}\n` +
      `📍 ${escapeHtml(match.fixture?.venue?.name || "TBD")}\n\n` +
      `═══════════════════════════════════\n`;

    return text;
  }

  /**
   * Format leaderboard with tier awareness
   */
  static formatLeaderboard(leaders, tier = "free") {
    let text = `🏆 <b>Leaderboard</b>\n\n`;

    leaders.forEach((user, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      text += `${medal} ${escapeHtml(user.name)}: ${user.score}\n`;
    });

    if (tier !== "vvip") {
      text += `\n💎 VVIP users get personalized leaderboard rankings`;
    }

    return text;
  }
}

export { UIBuilder, EMOJIS };
