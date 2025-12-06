/**
 * Fixture Tracker Service - Major upcoming fixtures
 * Static + dynamic data
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("FixtureTracker");
void logger;

class FixtureTrackerService {
  static BIG_FIXTURES = [
    {
      id: 1,
      home: "Manchester City",
      away: "Manchester United",
      league: "Premier League",
      date: "2025-12-15",
      importance: "🔥 DERBY",
    },
    {
      id: 2,
      home: "Liverpool",
      away: "Everton",
      league: "Premier League",
      date: "2025-12-22",
      importance: "🔥 DERBY",
    },
    {
      id: 3,
      home: "Barcelona",
      away: "Real Madrid",
      league: "La Liga",
      date: "2025-12-25",
      importance: "🏆 EL CLÁSICO",
    },
    {
      id: 4,
      home: "PSG",
      away: "Marseille",
      league: "Ligue 1",
      date: "2025-12-20",
      importance: "🔥 DERBY",
    },
    {
      id: 5,
      home: "Bayern Munich",
      away: "Borussia Dortmund",
      league: "Bundesliga",
      date: "2025-12-18",
      importance: "🔥 DERBY",
    },
  ];

  /**
   * Get upcoming big fixtures
   */
  static getUpcomingFixtures(_days = 30) {
    return this.BIG_FIXTURES;
  }

  /**
   * Track fixture
   */
  static trackFixture(fixtureId) {
    const fixture = this.BIG_FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return null;

    return {
      ...fixture,
      subscribed: true,
      notifications: ["goal", "fulltime"],
    };
  }

  /**
   * Format fixture for display
   */
  static formatFixture(fixture) {
    return `${fixture.importance} <b>${fixture.home} vs ${fixture.away}</b>\n` +
      `League: ${fixture.league}\n` +
      `Date: ${fixture.date}\n\n` +
      `⏰ Set reminder: /watch ${fixture.id}`;
  }

  /**
   * Format all fixtures
   */
  static formatAllFixtures(fixtures) {
    let text = `📅 <b>Big Fixtures Ahead</b>\n\n`;

    fixtures.forEach((f) => {
      text += `${f.importance} ${f.home} vs ${f.away}\n   ${f.date}\n\n`;
    });

    return text;
  }
}

export { FixtureTrackerService };
