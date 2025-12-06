/**
 * Betting Sites Service
 * Links to betting sites by country + affiliate integration
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("BettingSites");
void logger;

class BettingSitesService {
  static BETTING_SITES = {
    KE: [
      { name: "Bet365", url: "https://www.bet365.com/?affiliate=betrix", emoji: "🎲", rating: 4.8 },
      { name: "Betway", url: "https://www.betway.co.ke/?affiliate=betrix", emoji: "🎯", rating: 4.7 },
      { name: "Sportybet", url: "https://sportybet.com/?ref=betrix", emoji: "⚽", rating: 4.6 },
      { name: "1xBet", url: "https://1xbet.co.ke/?affiliate=betrix", emoji: "🏆", rating: 4.5 },
      { name: "BetKing", url: "https://betking.com/ke/?affiliate=betrix", emoji: "👑", rating: 4.4 },
    ],
    NG: [
      { name: "Bet9ja", url: "https://www.bet9ja.com/?ref=betrix", emoji: "🎲", rating: 4.7 },
      { name: "NairaBet", url: "https://www.nairabet.com/?affiliate=betrix", emoji: "💰", rating: 4.6 },
      { name: "Betway", url: "https://www.betway.ng/?affiliate=betrix", emoji: "🎯", rating: 4.7 },
      { name: "Bet365", url: "https://www.bet365.ng/?affiliate=betrix", emoji: "🏅", rating: 4.8 },
      { name: "1xBet", url: "https://1xbet.ng/?affiliate=betrix", emoji: "⭐", rating: 4.5 },
    ],
    ZA: [
      { name: "Bet365", url: "https://www.bet365.co.za/?affiliate=betrix", emoji: "🎲", rating: 4.8 },
      { name: "Betway", url: "https://www.betway.co.za/?affiliate=betrix", emoji: "🎯", rating: 4.7 },
      { name: "Supabets", url: "https://www.supabets.co.za/?affiliate=betrix", emoji: "🚀", rating: 4.6 },
      { name: "Hollywoodbets", url: "https://www.hollywoodbets.co.za/?affiliate=betrix", emoji: "🌟", rating: 4.5 },
      { name: "Sportingbet", url: "https://www.sportingbet.co.za/?affiliate=betrix", emoji: "⚽", rating: 4.4 },
    ],
    TZ: [
      { name: "Bet365", url: "https://www.bet365.com/?affiliate=betrix", emoji: "🎲", rating: 4.8 },
      { name: "Betway", url: "https://www.betway.tz/?affiliate=betrix", emoji: "🎯", rating: 4.7 },
      { name: "Sportybet", url: "https://sportybet.com/?ref=betrix", emoji: "⚽", rating: 4.6 },
    ],
    UG: [
      { name: "Bet365", url: "https://www.bet365.com/?affiliate=betrix", emoji: "🎲", rating: 4.8 },
      { name: "Betway", url: "https://www.betway.ug/?affiliate=betrix", emoji: "🎯", rating: 4.7 },
      { name: "Sportybet", url: "https://sportybet.com/?ref=betrix", emoji: "⚽", rating: 4.6 },
    ],
    GH: [
      { name: "Bet365", url: "https://www.bet365.com/?affiliate=betrix", emoji: "🎲", rating: 4.8 },
      { name: "Betway", url: "https://www.betway.gh/?affiliate=betrix", emoji: "🎯", rating: 4.7 },
      { name: "SolidBet", url: "https://solidbet.gh/?affiliate=betrix", emoji: "💎", rating: 4.5 },
    ],
    US: [
      { name: "DraftKings", url: "https://www.draftkings.com/?affiliate=betrix", emoji: "🏀", rating: 4.8 },
      { name: "FanDuel", url: "https://www.fanduel.com/?affiliate=betrix", emoji: "🎯", rating: 4.8 },
      { name: "BetMGM", url: "https://www.betmgm.com/?affiliate=betrix", emoji: "🏆", rating: 4.7 },
      { name: "Caesars", url: "https://www.caesars.com/?affiliate=betrix", emoji: "🎰", rating: 4.6 },
    ],
    GB: [
      { name: "Bet365", url: "https://www.bet365.com/?affiliate=betrix", emoji: "🎲", rating: 4.8 },
      { name: "Betfair", url: "https://www.betfair.com/?affiliate=betrix", emoji: "📊", rating: 4.7 },
      { name: "Sky Bet", url: "https://www.skybet.com/?affiliate=betrix", emoji: "🌟", rating: 4.6 },
      { name: "William Hill", url: "https://williamhill.com/?affiliate=betrix", emoji: "👑", rating: 4.5 },
    ],
    AU: [
      { name: "Sportsbet", url: "https://www.sportsbet.com.au/?affiliate=betrix", emoji: "🏏", rating: 4.8 },
      { name: "TAB", url: "https://www.tab.com.au/?affiliate=betrix", emoji: "🎲", rating: 4.7 },
      { name: "Ladbrokes", url: "https://www.ladbrokes.com.au/?affiliate=betrix", emoji: "🐴", rating: 4.6 },
    ],
    FR: [
      { name: "Betclic", url: "https://www.betclic.fr/?affiliate=betrix", emoji: "🎯", rating: 4.7 },
      { name: "France-Pari", url: "https://www.france-pari.fr/?affiliate=betrix", emoji: "🇫🇷", rating: 4.6 },
      { name: "Unibet", url: "https://www.unibet.fr/?affiliate=betrix", emoji: "🌟", rating: 4.5 },
    ],
    DEFAULT: [
      { name: "Bet365", url: "https://www.bet365.com/?affiliate=betrix", emoji: "🎲", rating: 4.8 },
      { name: "Betfair", url: "https://www.betfair.com/?affiliate=betrix", emoji: "📊", rating: 4.7 },
      { name: "1xBet", url: "https://1xbet.com/?affiliate=betrix", emoji: "⭐", rating: 4.5 },
    ],
  };

  /**
   * Get betting sites for country
   */
  static getSitesForCountry(countryCode) {
    return this.BETTING_SITES[countryCode] || this.BETTING_SITES.DEFAULT;
  }

  /**
   * Format betting sites for display
   */
  static formatSitesDisplay(countryCode) {
    const sites = this.getSitesForCountry(countryCode);
    let text = `🎲 <b>Recommended Betting Sites</b>\n\n`;

    sites.forEach((site) => {
      text += `${site.emoji} <b>${site.name}</b>\n`;
      text += `   Rating: ${"⭐".repeat(Math.round(site.rating))}\n`;
      text += `   <a href="${site.url}">Place Bets →</a>\n\n`;
    });

    text += `\n💡 All links are affiliate partners of BETRIX.\n`;
    text += `Support us by using these links!`;

    return text;
  }

  /**
   * Get top recommended site
   */
  static getTopSite(countryCode) {
    const sites = this.getSitesForCountry(countryCode);
    return sites[0];
  }

  /**
   * Generate quick betting links keyboard
   */
  static buildBettingSitesKeyboard(countryCode) {
    const sites = this.getSitesForCountry(countryCode);

    return {
      inline_keyboard: sites.map((site) => [
        {
          text: `${site.emoji} ${site.name}`,
          url: site.url,
        },
      ]),
    };
  }
}

export { BettingSitesService };
