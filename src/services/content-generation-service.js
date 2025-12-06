/**
 * Content Generation Service - Free content variations
 * Generates betting tips, analysis variations, and content without APIs
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("ContentGen");
void logger;

class ContentGenerationService {
  /**
   * Generate varied betting tips
   */
  static generateBettingTip() {
    const tips = [
      "🎯 Tip 1: Always bet with your head, not your heart. Emotion is the enemy of profits.",
      "💰 Tip 2: The best bets aren't always the favorites. Look for undervalued odds with good form.",
      "📊 Tip 3: Track every bet. Data reveals patterns. Your edge comes from what others miss.",
      "🏆 Tip 4: One loss doesn't define you. One win doesn't either. Focus on long-term results.",
      "🔥 Tip 5: When you hit a winning streak, stick to your system. Don't get cocky.",
      "🛡️ Tip 6: Bankroll management > picking winners. Protect your capital always.",
      "🧠 Tip 7: The sharps fade public opinion. When 80% are on one side, investigate the other.",
      "📈 Tip 8: Value betting beats prediction betting. Find +EV, not just winners.",
      "⚡ Tip 9: Live betting shows reality. Use halftime data to adjust your 2H predictions.",
      "🎓 Tip 10: Your first 50 bets are tuition. Learn, then optimize. Patience wins.",
    ];

    return tips[Math.floor(Math.random() * tips.length)];
  }

  /**
   * Generate match analysis template
   */
  static generateAnalysisTemplate(match) {
    return `📊 <b>MATCH ANALYSIS</b>

🏆 ${match.homeTeam || "HOME"} vs ${match.awayTeam || "AWAY"}

📈 <b>Form Analysis</b>
Home: Last 5 games - ${match.homeForm || "WDLLL"}
Away: Last 5 games - ${match.awayForm || "WWDDL"}

🎯 <b>Key Factors</b>
• Home advantage: ${match.homeAdvantage || "Yes"}
• Recent injuries: ${match.injuries || "None known"}
• Head-to-head: ${match.h2h || "Balanced"}

💡 <b>BETRIX Insight</b>
This match presents ${match.type || "a balanced"} betting opportunity. 
The ${match.favorite || "home team"} are favored, but ${match.contrarian || "there's value on the other side"}.

🎲 <b>Recommended Play</b>
• Pick: ${match.prediction || "Pending"}
• Odds: ${match.odds || "TBA"}
• Confidence: ${match.confidence || "70"}%
• Stake: ${match.stake || "2-3% of bankroll"}`;
  }

  /**
   * Generate streak-based content
   */
  static generateStreakContent(streak) {
    const content = [
      { streak: 1, title: "🚀 Getting Started", msg: "First win! You're on your way." },
      { streak: 3, title: "🔥 Hot Hand", msg: "3 in a row! The momentum is real." },
      { streak: 5, title: "⭐ Unstoppable", msg: "5 straight! You're in the zone." },
      { streak: 10, title: "🏆 Legendary", msg: "10-win streak! You're a BETRIX master." },
      { streak: 20, title: "👑 King Status", msg: "20 wins! You're officially untouchable." },
      { streak: 50, title: "🌟 Hall of Fame", msg: "50-win streak! You're a betting legend!" },
    ];

    const match = content.find((c) => c.streak === streak) || content[content.length - 1];
    return `${match.title}\n\n${match.msg}\n\nKeep the momentum going! 🎯`;
  }

  /**
   * Generate personalized recommendations
   */
  static generatePersonalizedRec(userStats) {
    if (userStats.accuracy >= 75) {
      return "🎯 You're an expert! Your accuracy is elite. Consider increasing stakes on high-confidence picks.";
    }
    if (userStats.accuracy >= 65) {
      return "📈 You're trending right! Your form is solid. Focus on high-conviction plays and eliminate low-value bets.";
    }
    if (userStats.accuracy >= 55) {
      return "🎓 You're learning! Your accuracy is above average. Keep refining your analysis and tracking results.";
    }
    if (userStats.accuracy >= 45) {
      return "📊 Mixed results. Review your losing bets. What went wrong? Identify the pattern.";
    }
    return "💡 Struggling? Start with favorites and proven trends. Build confidence, then expand.";
  }

  /**
   * Generate achievement announcement
   */
  static generateAchievementAnnouncement(achievement) {
    return `🎉 <b>ACHIEVEMENT UNLOCKED!</b>

${achievement.emoji} <b>${achievement.name}</b>
${achievement.description}

Your progress:
✓ Keep building your streak
✓ Unlock more achievements
✓ Reach legendary status

You're crushing it! 🚀`;
  }
}

export { ContentGenerationService };
