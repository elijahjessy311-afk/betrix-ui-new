/**
 * Stadium Info Service - Stadium details and records
 * Static data (no API required)
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("StadiumInfo");
void logger;

class StadiumInfoService {
  static STADIUMS = {
    "Old Trafford": {
      capacity: 74140,
      team: "Manchester United",
      record: "4-0 vs Arsenal",
      opened: 1910,
      country: "England",
    },
    "Anfield": {
      capacity: 61294,
      team: "Liverpool",
      record: "6-0 vs Derby County",
      opened: 1892,
      country: "England",
    },
    "Camp Nou": {
      capacity: 99354,
      team: "Barcelona",
      record: "12-0 vs Valencia",
      opened: 1957,
      country: "Spain",
    },
    "Bernabéu": {
      capacity: 81044,
      team: "Real Madrid",
      record: "11-1 vs Eintracht",
      opened: 1947,
      country: "Spain",
    },
    "Allianz Arena": {
      capacity: 75024,
      team: "Bayern Munich",
      record: "9-2 vs Basel",
      opened: 2006,
      country: "Germany",
    },
  };

  /**
   * Get stadium info
   */
  static getStadiumInfo(name) {
    return this.STADIUMS[name] || null;
  }

  /**
   * Get home advantage impact
   */
  static getHomeAdvantageImpact(stadium) {
    const info = this.getStadiumInfo(stadium);
    if (!info) return "Unknown stadium";

    const impact = [];
    if (info.capacity > 70000) impact.push("Large crowd - intimidating");
    if (info.opened < 1950) impact.push("Historic ground - strong home support");

    return impact.length > 0
      ? impact.join(" | ")
      : "Standard home advantage";
  }

  /**
   * Format stadium display
   */
  static formatStadium(name) {
    const info = this.getStadiumInfo(name);
    if (!info) return `❓ Stadium "${name}" info not available`;

    return `🏟️ <b>${name}</b>\n` +
      `Team: ${info.team}\n` +
      `Capacity: ${info.capacity.toLocaleString()}\n` +
      `Record Win: ${info.record}\n` +
      `Opened: ${info.opened}\n` +
      `Country: ${info.country}`;
  }

  /**
   * All stadiums
   */
  static listStadiums() {
    return Object.keys(this.STADIUMS);
  }
}

export { StadiumInfoService };
