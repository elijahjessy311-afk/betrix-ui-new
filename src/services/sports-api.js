import fetch from 'node-fetch';

export class SportsAPI {
  static async fetchFootballMatches(_league = 'EPL') {
    try {
      const response = await fetch(`${process.env.API_FOOTBALL_BASE}/fixtures?league=39&season=2025`, {
        headers: {
          'x-apisports-key': process.env.API_FOOTBALL_KEY
        }
      });
      const data = await response.json();
      return data.response || [];
    } catch (error) {
      console.error('Football API error:', error);
      return [];
    }
  }

  static async fetchRapidAPI(host, path) {
    try {
      const response = await fetch(`https://${host}${path}`, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': host
        }
      });
      return await response.json();
    } catch (error) {
      console.error(`RapidAPI error (${host}):`, error);
      return null;
    }
  }

  static async getLiveFootball() {
    return await this.fetchRapidAPI('sofascore.p.rapidapi.com', '/football/live');
  }

  static async getLiveBasketball() {
    return await this.fetchRapidAPI('sofascore.p.rapidapi.com', '/basketball/live');
  }

  static async getTennisMatches() {
    return await this.fetchRapidAPI('sofascore.p.rapidapi.com', '/tennis/live');
  }

  static async getCricketMatches() {
    return await this.fetchRapidAPI('cricket-api.p.rapidapi.com', '/matches/live');
  }

  static async getMatchOdds(sport, matchId) {
    const hosts = {
      football: 'odds-api.p.rapidapi.com',
      basketball: 'odds-api.p.rapidapi.com',
      tennis: 'odds-api.p.rapidapi.com'
    };
    
    const host = hosts[sport.toLowerCase()] || 'odds-api.p.rapidapi.com';
    return await this.fetchRapidAPI(host, `/odds/${matchId}`);
  }

  static async getBinanceCrypto(symbol = 'BTCUSDT') {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      return await response.json();
    } catch (error) {
      console.error('Binance API error:', error);
      return null;
    }
  }

  static async getWeather(city) {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
      );
      return await response.json();
    } catch (error) {
      console.error('Weather API error:', error);
      return null;
    }
  }

  static formatLiveMatches(matches, sport) {
    if (!matches || matches.length === 0) {
      return `No live ${sport} matches at the moment. Check back later!`;
    }

    let text = `⚡ **Live ${sport} Matches**\n\n`;
    matches.slice(0, 5).forEach((match, index) => {
      const home = match.homeTeam?.name || match.home || 'Team 1';
      const away = match.awayTeam?.name || match.away || 'Team 2';
      const score = match.score ? `${match.score.home} - ${match.score.away}` : 'vs';
      text += `${index + 1}. ${home} ${score} ${away}\n`;
    });
    return text;
  }
}
