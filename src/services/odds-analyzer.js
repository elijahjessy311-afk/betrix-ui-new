/**
 * Odds Analysis Service
 * Analyzes betting odds, calculates value, generates predictions
 * Integrates with SportsAggregator for real-time odds
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('OddsAnalyzer');

export class OddsAnalyzer {
  constructor(redis, sportsAggregator, aiService = null) {
    this.redis = redis;
    this.sportsAggregator = sportsAggregator;
    this.aiService = aiService;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 min cache for analysis
  }

  /**
   * Analyze odds for a match
   * Returns: prediction, confidence, value indication, recommended bet
   */
  async analyzeMatch(homeTeam, awayTeam, leagueId = null) {
    try {
      const cacheKey = `analysis:${homeTeam}:${awayTeam}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTTL) {
          return cached.data;
        }
      }

      // Get odds from aggregator
      const odds = await this.sportsAggregator.getOdds(leagueId);
      const matchOdds = odds.find(o => 
        o.home?.toLowerCase() === homeTeam.toLowerCase() &&
        o.away?.toLowerCase() === awayTeam.toLowerCase()
      );

      if (!matchOdds) {
        return {
          status: 'not_found',
          message: `No odds found for ${homeTeam} vs ${awayTeam}`,
          confidence: 0
        };
      }

      // Calculate implied probabilities
      const probabilities = this._calculateProbabilities(matchOdds);

      // Determine prediction based on various factors
      const prediction = this._determinePrediction(probabilities, matchOdds);

      // Calculate value and ROI potential
      const value = this._calculateValue(prediction, matchOdds);

      // Get AI insights if available
      let aiInsight = null;
      if (this.aiService && this.aiService.analyze) {
        try {
          aiInsight = await this.aiService.analyze(`${homeTeam} vs ${awayTeam}`, { type: 'odds' });
        } catch (e) {
          logger.warn('AI analysis failed', e.message);
        }
      }

      const analysis = {
        match: `${homeTeam} vs ${awayTeam}`,
        odds: {
          home: matchOdds.homeOdds,
          draw: matchOdds.drawOdds,
          away: matchOdds.awayOdds,
          bookmaker: matchOdds.bookmaker
        },
        probabilities,
        prediction,
        confidence: prediction.confidence,
        value,
        recommendation: this._getRecommendation(prediction, value),
        aiInsight: aiInsight?.text || null,
        timestamp: Date.now()
      };

      this._setCached(cacheKey, analysis);
      return analysis;
    } catch (err) {
      logger.error('analyzeMatch failed', err);
      return {
        status: 'error',
        message: err.message,
        confidence: 0
      };
    }
  }

  /**
   * Get multiple matches analysis
   */
  async analyzeLiveMatches(leagueId = null) {
    try {
      const matches = await this.sportsAggregator.getLiveMatches(leagueId);
      if (!matches || !Array.isArray(matches)) return [];

      const analyses = [];

      for (const match of matches.slice(0, 5)) {
        try {
          // Use homeTeam/awayTeam or home/away depending on data format
          const homeTeam = match.homeTeam || match.home;
          const awayTeam = match.awayTeam || match.away;
          
          if (!homeTeam || !awayTeam) continue; // Skip matches without teams
          
          const analysis = await this.analyzeMatch(homeTeam, awayTeam, leagueId);
          if (analysis.status !== 'error') {
            const homeScore = match.homeScore || match.score?.split('-')[0];
            const awayScore = match.awayScore || match.score?.split('-')[1];
            
            analyses.push({
              ...analysis,
              match: `${homeTeam} vs ${awayTeam}`,
              score: `${homeScore}-${awayScore}`,
              status: match.status || 'UNKNOWN',
              time: match.time
            });
          }
        } catch (e) {
          const homeTeam = match.homeTeam || match.home;
          const awayTeam = match.awayTeam || match.away;
          if (homeTeam && awayTeam) {
            logger.warn(`Analysis failed for ${homeTeam} vs ${awayTeam}: ${e.message}`);
          }
        }
      }

      return analyses;
    } catch (err) {
      logger.error('analyzeLiveMatches failed', err);
      return [];
    }
  }

  /**
   * Calculate implied probabilities from odds
   */
  _calculateProbabilities(odds) {
    // Convert decimal odds to implied probability
    const homeProb = (1 / odds.homeOdds) * 100;
    const drawProb = (1 / odds.drawOdds) * 100;
    const awayProb = (1 / odds.awayOdds) * 100;
    const total = homeProb + drawProb + awayProb;

    // Normalize (remove vig)
    const margin = total - 100;
    return {
      home: Math.round((homeProb / total) * 100),
      draw: Math.round((drawProb / total) * 100),
      away: Math.round((awayProb / total) * 100),
      margin
    };
  }

  /**
   * Determine prediction based on probabilities
   */
  _determinePrediction(probs, odds) {
    const outcomes = [
      { type: 'HOME_WIN', prob: probs.home, odds: odds.homeOdds },
      { type: 'DRAW', prob: probs.draw, odds: odds.drawOdds },
      { type: 'AWAY_WIN', prob: probs.away, odds: odds.awayOdds }
    ];

    // Pick highest probability
    const best = outcomes.reduce((a, b) => a.prob > b.prob ? a : b);

    // Calculate confidence (how much better than 2nd best)
    const sorted = outcomes.sort((a, b) => b.prob - a.prob);
    const confidence = Math.min(95, Math.max(50, sorted[0].prob - sorted[1].prob + 40));

    return {
      outcome: best.type,
      probability: best.prob,
      odds: best.odds,
      confidence: Math.round(confidence)
    };
  }

  /**
   * Calculate value potential
   */
  _calculateValue(prediction, odds) {
    const bookProb = 1 / prediction.odds; // Implied probability from odds
    const ourProb = prediction.probability / 100;
    const edge = (ourProb - bookProb) / bookProb * 100;
    const expectedValue = (ourProb * prediction.odds - 1) * 100;

    return {
      hasValue: edge > 5, // 5% edge threshold
      edge: Math.round(edge * 10) / 10,
      expectedValue: Math.round(expectedValue),
      recommendation: edge > 5 ? 'STRONG PLAY' : (edge > 0 ? 'MARGINAL VALUE' : 'NO VALUE')
    };
  }

  /**
   * Get betting recommendation
   */
  _getRecommendation(prediction, value) {
    const confidence = prediction.confidence;
    const hasValue = value.hasValue;

    if (!hasValue) return '❌ No clear value';
    if (confidence >= 75) return '🟢 STRONG BET';
    if (confidence >= 65) return '🟡 MODERATE BET';
    if (confidence >= 55) return '🟠 CAUTIOUS BET';
    return '🔴 SKIP';
  }

  /**
   * Format analysis for Telegram
   */
  formatForTelegram(analysis) {
    if (analysis.status === 'error') {
      return `❌ Analysis unavailable: ${analysis.message}`;
    }

    const { match, odds, prediction, value, confidence, recommendation } = analysis;

    let text = `🔍 *Odds Analysis*\n\n`;
    text += `*${match}*\n`;
    text += `Bookmaker: ${odds.bookmaker}\n\n`;

    text += `*Odds (1X2):*\n`;
    text += `1: ${odds.home} | X: ${odds.draw} | 2: ${odds.away}\n\n`;

    text += `*Prediction:*\n`;
    const outcomeEmoji = {
      'HOME_WIN': '🏠',
      'DRAW': '🤝',
      'AWAY_WIN': '🚗'
    }[prediction.outcome] || '⚽';
    text += `${outcomeEmoji} ${prediction.outcome.replace(/_/g, ' ')}\n`;
    text += `Confidence: *${confidence}%*\n`;
    text += `Odds: *${prediction.odds}*\n\n`;

    text += `*Value Analysis:*\n`;
    text += `Edge: *${value.edge}%*\n`;
    text += `Expected ROI: *${value.expectedValue}%*\n`;
    text += `Recommendation: *${recommendation}*\n\n`;

    if (analysis.aiInsight) {
      text += `*AI Insight:*\n${analysis.aiInsight}\n\n`;
    }

    text += `💡 Staking: Only bet if confidence >60% & edge >5%\n`;
    text += `⚠️ Always use bankroll management (max 2% per bet)`;

    return text;
  }

  /**
   * Get Quick Tips based on current market
   */
  async getQuickTips(leagueId = null) {
    try {
      const analyses = await this.analyzeLiveMatches(leagueId);
      const plays = analyses
        .filter(a => a.value?.hasValue && a.confidence >= 60)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      let tips = `🎯 *Today's Best Plays*\n\n`;

      if (plays.length === 0) {
        tips += `No clear value plays today. Wait for better odds or \n`;
        tips += `consider other strategies. Better to stay out than force a bad bet.`;
        return tips;
      }

      plays.forEach((play, idx) => {
        tips += `${idx + 1}. *${play.match}*\n`;
        tips += `   ${play.prediction.outcome.replace(/_/g, ' ')} @ ${play.prediction.odds}\n`;
        tips += `   Confidence: ${play.confidence}% | Edge: ${play.value.edge}%\n\n`;
      });

      tips += `✅ All plays have >5% edge & >60% confidence\n`;
      tips += `💰 Stake guideline: Risk 1-2% bankroll per play`;

      return tips;
    } catch (err) {
      logger.error('getQuickTips failed', err);
      return `Unable to generate tips. Try again later.`;
    }
  }

  /**
   * Compare odds across multiple bookmakers
   */
  async compareOdds(homeTeam, awayTeam, leagueId = null) {
    try {
      const odds = await this.sportsAggregator.getOdds(leagueId);
      const matchOdds = odds.filter(o =>
        o.home?.toLowerCase() === homeTeam.toLowerCase() &&
        o.away?.toLowerCase() === awayTeam.toLowerCase()
      );

      if (matchOdds.length === 0) {
        return `No odds comparison available for ${homeTeam} vs ${awayTeam}`;
      }

      let text = `💰 *Odds Comparison*\n\n*${homeTeam} vs ${awayTeam}*\n\n`;

      // Find best odds for each outcome
      const bestHome = Math.max(...matchOdds.map(o => o.homeOdds));
      const bestDraw = Math.max(...matchOdds.map(o => o.drawOdds));
      const bestAway = Math.max(...matchOdds.map(o => o.awayOdds));

      text += `*Bookmakers:*\n`;
      matchOdds.forEach(odds => {
        text += `\n${odds.bookmaker}:\n`;
        text += `  1: ${odds.homeOdds} ${odds.homeOdds === bestHome ? '✅' : ''}\n`;
        text += `  X: ${odds.drawOdds} ${odds.drawOdds === bestDraw ? '✅' : ''}\n`;
        text += `  2: ${odds.awayOdds} ${odds.awayOdds === bestAway ? '✅' : ''}\n`;
      });

      text += `\n✅ = Best odds for this outcome`;

      return text;
    } catch (err) {
      logger.error('compareOdds failed', err);
      return `Unable to compare odds. Try again later.`;
    }
  }

  _setCached(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

export default OddsAnalyzer;
