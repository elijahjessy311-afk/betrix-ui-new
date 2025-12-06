/**
 * Meme Generator Service - Free meme creation
 * Uses imgflip API (no auth needed) or text-based memes
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("MemeService");
void logger;

class MemeService {
  /**
   * Generate text-based betting meme
   */
  static generateTextMeme(prediction, odds, team) {
    const memes = [
      `🎯 ME: "I'm confident about ${team}"\nODDS: ${odds}\nREALITY: 🔴 RED CARD INCOMING`,
      `💭 BRAIN: "Don't chase losses"\n🎲 ME PLACING ${odds} ODDS BET: I'll take that`,
      `BETRIX: "This bet has 80% confidence"\nME: *loses*\nBETRIX: "That's sports betting" 🤷`,
      `📈 BET SLIP READY\n⏰ 3 MINUTES LATER\n😭 STONKS: ↓↓↓`,
      `🏆 ME AFTER 1 WIN:\n👑 BET KING\n🎯 ${odds} ODDS? EASY\n\n💔 3 HOURS LATER:\n🦆 BROKE AF`,
    ];
    return memes[Math.floor(Math.random() * memes.length)];
  }

  /**
   * Generate streak meme
   */
  static generateStreakMeme(streak) {
    if (streak < 3) return "🔥 Getting started...";
    if (streak < 5) return "🔥 ON FIRE 🔥\nLet's gooooo!";
    if (streak < 10) return "🚀 LEGENDARY STATUS\n👑 BETTING KING 👑";
    if (streak < 20) return "🏆 GOD MODE ACTIVATED\n💎 UNTOUCHABLE 💎";
    return `🌟 ${streak}-WIN STREAK 🌟\nYOU ARE THE CHOSEN ONE`;
  }

  /**
   * Generate loss recovery meme
   */
  static generateRecoveryMeme() {
    const memes = [
      "💪 Losses are just expensive lessons\n📚 I'm now an expert on what NOT to bet",
      "🔄 Trading losses for wisdom\n💡 Next time will be different (it won't)",
      "📉 My portfolio: 📊\nMy confidence: 📈🚀",
      "😅 YOLO investments be like:\n💰 → 💸 → 😭",
      "🎓 Tuition paid to the betting gods\n🧠 Education received: PRICELESS",
    ];
    return memes[Math.floor(Math.random() * memes.length)];
  }

  /**
   * Generate achievement meme
   */
  static generateAchievementMeme(achievement) {
    return `🎉 ACHIEVEMENT UNLOCKED 🎉\n\n${achievement.emoji} ${achievement.name}\n\n✨ YOU'RE AWESOME ✨`;
  }

  /**
   * Generate odds reaction meme
   */
  static generateOddsReactionMeme(odds) {
    if (odds > 5) {
      return `ODDS: ${odds}\nMY CONFIDENCE: 📈\nREALITY: 📉📉📉\nRESULT: 💀`;
    }
    if (odds > 3) {
      return `DECENT ODDS: ${odds}\nME: "I like these odds"\n*clicks*\n30 MINS LATER: WHY DID I CLICK`;
    }
    return `SAFE BET: ${odds}\nME: "Bored..."\n*adds more matches*\n*now odds = 5*\n😱`;
  }

  /**
   * Format meme for display
   */
  static formatMeme(memeText) {
    return `\`\`\`
${memeText}
\`\`\``;
  }
}

export { MemeService };
