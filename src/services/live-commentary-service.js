/**
 * Live Commentary Service - AI-generated match commentary
 * No API required - template-based
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("Commentary");
void logger;

class LiveCommentaryService {
  static EVENTS = [
    "🟡 Yellow card - harsh decision!",
    "⚽ GOAL! GOALLLL! The crowd is going mad!",
    "🚨 Close! Post! Just inches away!",
    "🔄 Substitution - fresh legs coming on",
    "🏥 Injury time - medical team on field",
    "🎯 Chance missed - should have buried it!",
    "🛡️ Fantastic defending - cleared the danger",
    "⚡ Brilliant pass - splits the defense!",
    "🔴 RED CARD - Player sent off!",
    "🏁 VAR Review - checking the goal",
  ];

  static COMMENTARY = [
    "Manchester United pressing hard at the moment.",
    "The home side is controlling the midfield.",
    "What a strike! That's a professional finish.",
    "The away team is starting to find their rhythm.",
    "Brilliant interception by the defender!",
    "The goalkeeper makes a crucial save!",
    "Wide open spaces for the attackers now.",
    "Defensive organization is key here.",
    "The momentum has shifted in recent minutes.",
    "Both teams are leaving everything on the pitch.",
  ];

  /**
   * Generate live event
   */
  static generateEvent() {
    return this.EVENTS[Math.floor(Math.random() * this.EVENTS.length)];
  }

  /**
   * Generate commentary
   */
  static generateCommentary() {
    return this.COMMENTARY[Math.floor(Math.random() * this.COMMENTARY.length)];
  }

  /**
   * Simulate match minute
   */
  static simulateMinute(minute) {
    const shouldEvent = Math.random() > 0.7;
    const event = shouldEvent ? this.generateEvent() : null;
    const commentary = this.generateCommentary();

    return {
      minute,
      event,
      commentary,
    };
  }

  /**
   * Generate live match update
   */
  static generateLiveUpdate(team1, team2, score1, score2) {
    const minute = Math.floor(Math.random() * 90) + 1;
    const update = this.simulateMinute(minute);

    return `⚽ <b>LIVE: ${team1} vs ${team2}</b>\n` +
      `Score: ${score1} - ${score2}\n` +
      `⏱️ ${minute}'\n\n` +
      (update.event ? `${update.event}\n` : "") +
      `📻 ${update.commentary}`;
  }
}

export { LiveCommentaryService };
