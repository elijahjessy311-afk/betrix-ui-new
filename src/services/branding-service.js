/**
 * BETRIX Branding Service
 * Consistent logo, icons, colors, and visual identity
 */

class BrandingService {
  // BETRIX Official Logo (ASCII Art)
  static LOGO = `
╔═══════════════════════════════════════════════╗
║                                               ║
║        ██████╗ ███████╗████████╗██████╗ ██╗██╗ ║
║        ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██║██║ ║
║        ██████╔╝█████╗     ██║   ██████╔╝██║██║ ║
║        ██╔══██╗██╔══╝     ██║   ██╔══██╗██║██║ ║
║        ██████╔╝███████╗   ██║   ██║  ██║██║██║ ║
║        ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝ ║
║                                               ║
║   🌟 Professional Sports Betting AI 🌟        ║
║                                               ║
╚═══════════════════════════════════════════════╝
`;

  // Compact Logo
  static LOGO_COMPACT = `💎 BETRIX 💎`;

  // Icons for all features
  static ICONS = {
    // Branding (4)
    brand: "💎",
    betrix: "🎯",
    pro: "⭐",
    special: "🌟",
    
    // Main Features (8)
    menu: "📋",
    live: "🔴",
    standings: "📊",
    odds: "🎲",
    analyze: "🔍",
    tips: "💡",
    help: "❓",
    search: "🔎",
    
    // Predictions & Analysis (4)
    predict: "🧠",
    insights: "💭",
    coach: "🎓",
    compete: "🏆",
    
    // Payments (4)
    pricing: "💰",
    vvip: "👑",
    member: "💎",
    free: "🎁",
    
    // Betting (5)
    betslip: "📋",
    watch: "👁️",
    parlay: "🔗",
    odds_high: "📈",
    odds_low: "📉",
    
    // Leaderboard (3)
    leaderboard: "🏅",
    rank: "🥇",
    streak: "🔥",
    
    // Notifications (4)
    notification: "🔔",
    goal: "⚽",
    milestone: "🎉",
    achievement: "🏆",
    
    // Status (4)
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
    
    // Social (3)
    refer: "👥",
    share: "📢",
    community: "👫",
    
    // Account & Settings (6)
    settings: "⚙️",
    stats: "📈",
    history: "📜",
    support: "🤝",
    language: "🌍",
    verify: "🔐",
    
    // Sports (5)
    soccer: "⚽",
    basketball: "🏀",
    football: "🏈",
    tennis: "🎾",
    cricket: "🏏",
    
    // Utilities (10)
    hot: "🔥",
    amazing: "✨",
    perfect: "💯",
    analytics: "📊",
    mobile: "📱",
    online: "🌐",
    chat: "💬",
    target: "🎯",
    rocket: "🚀",
    approve: "👌",
    
    // Additional (3)
    medal: "🥇",
    silver: "🥈",
    bronze: "🥉",
  };

  // Brand Colors (for future web/image support)
  static COLORS = {
    primary: "#2563EB",      // Bright Blue
    secondary: "#7C3AED",    // Deep Purple
    accent: "#DC2626",       // Vibrant Red
    success: "#16A34A",      // Green
    warning: "#EA580C",      // Orange
    dark: "#1F2937",         // Dark Gray
    light: "#F3F4F6",        // Light Gray
  };

  // Brand Fonts (emoji-based styling)
  static STYLES = {
    header: "🎯",
    subheader: "→",
    bullet: "•",
    separator: "─",
  };

  /**
   * Format with BETRIX branding
   */
  static brand(text, icon = "💎") {
    return `${icon} <b>BETRIX</b> ${icon}\n${text}`;
  }

  /**
   * Create branded section
   */
  static section(title, content, icon = "📋") {
    return `${icon} <b>${title}</b>\n${content}`;
  }

  /**
   * Create branded menu item
   */
  static menuItem(command, description, icon) {
    return `${icon} <code>${command}</code> — ${description}`;
  }

  /**
   * Create branded button
   */
  static button(text, icon = "▶") {
    return `${icon} ${text}`;
  }

  /**
   * Format header
   */
  static header(text) {
    return `╔${'═'.repeat(text.length + 2)}╗\n║ ${text} ║\n╚${'═'.repeat(text.length + 2)}╝`;
  }

  /**
   * Get icon for command
   */
  static getIcon(key) {
    return this.ICONS[key] || "•";
  }

  /**
   * Create welcome message with branding
   */
  static getWelcome(userName) {
    return `${this.LOGO}

${this.ICONS.betrix} Welcome to <b>BETRIX</b>, ${userName}!

Your autonomous AI sports analyst powered by advanced machine learning.
Get professional betting analysis, real-time alerts, and proven strategies.

${this.ICONS.pro} <b>What can I do?</b>
${this.ICONS.odds} Live match odds and analysis
${this.ICONS.predict} AI predictions with confidence scoring
${this.ICONS.leaderboard} Real-time leaderboards and rankings
${this.ICONS.achieve} Achievements and rewards
${this.ICONS.coach} Personal betting coach

/menu — Explore all features
/help — Learn how to use BETRIX`;
  }

  /**
   * Create branded menu
   */
  static getMenu() {
    return `${this.ICONS.betrix} <b>BETRIX MENU</b>

${this.ICONS.live} <b>LIVE MATCHES</b>
${this.menuItem("/live", "View live matches now", this.ICONS.live)}
${this.menuItem("/odds", "Check latest odds", this.ICONS.odds)}

${this.ICONS.predict} <b>ANALYSIS</b>
${this.menuItem("/analyze", "AI match analysis", this.ICONS.analyze)}
${this.menuItem("/predict", "Get predictions", this.ICONS.predict)}
${this.menuItem("/insights", "Personalized insights", this.ICONS.insights)}

${this.ICONS.coach} <b>PREMIUM</b>
${this.menuItem("/coach", "Personal betting coach", this.ICONS.coach)}
${this.menuItem("/dossier", "Professional dossier", this.ICONS.pro)}
${this.menuItem("/trends", "Seasonal analysis", this.ICONS.stats)}

${this.ICONS.leaderboard} <b>COMPETE</b>
${this.menuItem("/compete", "See leaderboards", this.ICONS.leaderboard)}
${this.menuItem("/stats", "Your stats", this.ICONS.stats)}
${this.menuItem("/achievements", "Unlock badges", this.ICONS.achievement)}

${this.ICONS.pricing} <b>ACCOUNT</b>
${this.menuItem("/pricing", "View plans", this.ICONS.pricing)}
${this.menuItem("/refer", "Earn rewards", this.ICONS.refer)}
${this.menuItem("/status", "Account info", this.ICONS.pro)}`;
  }

  /**
   * Create branded feature description
   */
  static getFeatureDescription(feature) {
    const features = {
      leaderboard: `${this.ICONS.leaderboard} <b>Live Leaderboards</b>\nCompete daily with other users. See rankings, points, and streaks in real-time.`,
      coach: `${this.ICONS.coach} <b>AI Betting Coach</b>\nPersonalized advice based on your performance. Kelly Criterion sizing and risk management.`,
      notifications: `${this.ICONS.notification} <b>Smart Notifications</b>\nGoal alerts, odds movement warnings, match reminders, and streak notifications.`,
      achievements: `${this.ICONS.achievement} <b>25+ Achievements</b>\nUnlock badges for milestones. Build streaks, reach accuracy targets, grow your network.`,
      betslips: `${this.ICONS.betslip} <b>Professional Betslips</b>\nAI-analyzed betslips with odds calculations. Direct links to betting sites in your country.`,
    };
    return features[feature] || feature;
  }

  /**
   * Create branded success message
   */
  static success(message) {
    return `${this.ICONS.success} <b>Success!</b>\n${message}`;
  }

  /**
   * Create branded error message
   */
  static error(message) {
    return `${this.ICONS.error} <b>Error</b>\n${message}`;
  }

  /**
   * Create branded info message
   */
  static info(message) {
    return `${this.ICONS.info} <b>Info</b>\n${message}`;
  }

  /**
   * Create branded warning message
   */
  static warning(message) {
    return `${this.ICONS.warning} <b>Warning</b>\n${message}`;
  }

  /**
   * Get brand tagline
   */
  static getTagline() {
    const taglines = [
      "🎯 Professional Sports AI",
      "⚽ Your Betting Coach",
      "🏆 Win With Confidence",
      "📊 Data-Driven Predictions",
      "💎 World-Class Analysis",
      "🚀 Next-Gen Betting",
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }

  /**
   * Get brand footer
   */
  static getFooter() {
    return `\n\n${'─'.repeat(50)}\n💎 Powered by BETRIX AI\n${this.getTagline()}\n${'─'.repeat(50)}`;
  }
}

export { BrandingService };
