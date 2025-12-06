/**
 * Sports Trivia & Quotes Service
 * No API required - built-in content
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("SportTrivia");
void logger;

class SportsTriviaService {
  static QUOTES = [
    "The game is not about how hard you hit. It's about how hard you can get hit and keep moving. - Rocky",
    "Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love. - Pelé",
    "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.' - Muhammad Ali",
    "The only way to prove that you're a good sport is to lose. - Ernie Banks",
    "If you're not prepared to be wrong, you'll never come up with anything original. - Sir Alex Ferguson",
    "In football, the worst thing you can do is overthink. Play with your heart, trust your instincts. - Cristiano Ronaldo",
    "A champion keeps playing until they get it right. - Billie Jean King",
    "Sports are not just about winning. They're about learning resilience and character. - Antonio McDyess",
    "The legs feed the wolf. - Gio van Bronckhorst",
    "Pressure is a privilege. The bigger the stage, the more I want it. - Megan Rapinoe",
  ];

  static FACTS = [
    "A regulation football match lasts 90 minutes with 2 halves of 45 minutes each.",
    "The FIFA World Cup has been held every 4 years since 1930.",
    "Pelé scored over 1000 goals in his football career.",
    "The first modern Olympic Games in 1896 included no football.",
    "Bitcoin has a finite supply of 21 million coins.",
    "The fastest recorded soccer kick was 131 km/h by Ronny Fernández.",
    "Messi won 7 Ballon d'Or awards, more than any other player.",
    "Ronaldo has scored over 800 career goals across all competitions.",
    "The largest football stadium in the world is Rungrado 1st of May Stadium in North Korea with 114,000 capacity.",
    "Pele was only 17 when Brazil won the 1958 World Cup.",
  ];

  static BETTING_FACTS = [
    "Sharp bettors focus on finding +EV (positive expected value) opportunities, not just picking winners.",
    "The Kelly Criterion suggests betting 2% of your bankroll per unit on sports bets.",
    "Most casual bettors lose because they chase losses and increase stakes emotionally.",
    "Professional bettors track every bet for 50+ games before adjusting their strategy.",
    "Line shopping (comparing odds across sportsbooks) can improve returns by 2-3%.",
    "Underdogs in NFL games cover the spread 50% of the time on average.",
    "Home field advantage typically accounts for 2-3 points in NFL spreads.",
    "Inverse betting (betting against the public) wins 55%+ of the time long-term.",
    "The best bettors specialize in 2-3 leagues instead of playing everything.",
    "Variance exists over 50-100 bets; skill emerges over 1000+ bets.",
  ];

  static getRandomQuote() {
    return this.QUOTES[Math.floor(Math.random() * this.QUOTES.length)];
  }

  static getRandomFact() {
    return this.FACTS[Math.floor(Math.random() * this.FACTS.length)];
  }

  static getRandomBettingFact() {
    return this.BETTING_FACTS[Math.floor(Math.random() * this.BETTING_FACTS.length)];
  }

  static formatQuote() {
    return `💬 <b>Sports Quote</b>\n\n"${this.getRandomQuote()}"`;
  }

  static formatFact() {
    return `🏆 <b>Did You Know?</b>\n\n${this.getRandomFact()}`;
  }

  static formatBettingFact() {
    return `💡 <b>Betting Fact</b>\n\n${this.getRandomBettingFact()}`;
  }
}

export { SportsTriviaService };
