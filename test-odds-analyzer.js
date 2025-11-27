#!/usr/bin/env node

/**
 * Odds Analyzer Test
 * Test the odds analysis and prediction system
 */

import Redis from 'ioredis';
import SportsAggregator from './src/services/sports-aggregator.js';
import OddsAnalyzer from './src/services/odds-analyzer.js';
import { CONFIG } from './src/config.js';

const redisClient = new Redis(CONFIG.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379');

const sportsAggregator = new SportsAggregator(redisClient);
const oddsAnalyzer = new OddsAnalyzer(redisClient, sportsAggregator);

console.log('\n🎲 ODDS ANALYZER TEST\n');
console.log('='.repeat(70));

try {
  // Test 1: Get live matches
  console.log('\n📊 TEST 1: Analyzing Live Matches\n');
  const analyses = await oddsAnalyzer.analyzeLiveMatches();

  if (analyses && analyses.length > 0) {
    console.log(`✅ Analyzed ${analyses.length} live matches\n`);

    analyses.forEach((analysis, idx) => {
      console.log(`Match ${idx + 1}: ${analysis.match}`);
      console.log(`  Score: ${analysis.score} | Status: ${analysis.status}`);
      
      if (analysis.prediction) {
        console.log(`  Prediction: ${analysis.prediction.outcome.replace(/_/g, ' ')}`);
        console.log(`  Confidence: ${analysis.confidence}%`);
        console.log(`  Odds: ${analysis.prediction.odds}`);
        console.log(`  Value Edge: ${analysis.value?.edge || 'N/A'}%`);
        console.log(`  Recommendation: ${analysis.recommendation || 'N/A'}`);
      } else if (analysis.status === 'error') {
        console.log(`  ❌ Error: ${analysis.message}`);
      } else {
        console.log(`  Status: ${analysis.status}`);
      }
      console.log();
    });
  } else {
    console.log('ℹ️  No live matches available for analysis\n');
  }

  // Test 2: Specific match analysis
  console.log('📊 TEST 2: Analyzing Specific Match\n');
  const matchAnalysis = await oddsAnalyzer.analyzeMatch('Manchester United', 'Liverpool');

  if (matchAnalysis.status !== 'error') {
    console.log(`Match: ${matchAnalysis.match}`);
    console.log(`Bookmaker: ${matchAnalysis.odds.bookmaker}`);
    console.log(`Odds: 1=${matchAnalysis.odds.home} X=${matchAnalysis.odds.draw} 2=${matchAnalysis.odds.away}`);
    console.log(`\nPrediction: ${matchAnalysis.prediction.outcome.replace(/_/g, ' ')}`);
    console.log(`Confidence: ${matchAnalysis.confidence}%`);
    console.log(`Odds: ${matchAnalysis.prediction.odds}`);
    console.log(`\nValue Analysis:`);
    console.log(`  Edge: ${matchAnalysis.value.edge}%`);
    console.log(`  Expected ROI: ${matchAnalysis.value.expectedValue}%`);
    console.log(`  Has Value: ${matchAnalysis.value.hasValue ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log(`${matchAnalysis.message}\n`);
  }

  // Test 3: Telegram formatting
  console.log('📊 TEST 3: Telegram Formatted Output\n');
  console.log('┌' + '─'.repeat(68) + '┐');
  const formatted = oddsAnalyzer.formatForTelegram(matchAnalysis);
  formatted.split('\n').forEach(line => {
    const displayLine = line.length > 66 ? line.substring(0, 63) + '...' : line;
    console.log('│ ' + displayLine + ' '.repeat(Math.max(0, 66 - displayLine.length)) + '│');
  });
  console.log('└' + '─'.repeat(68) + '┘');

  // Test 4: Quick tips
  console.log('\n📊 TEST 4: Quick Tips\n');
  const tips = await oddsAnalyzer.getQuickTips();
  console.log(tips);

  // Test 5: Odds comparison
  console.log('\n📊 TEST 5: Odds Comparison\n');
  const comparison = await oddsAnalyzer.compareOdds('Manchester United', 'Liverpool');
  console.log(comparison);

} catch (error) {
  console.error('❌ Test error:', error.message);
  console.error(error.stack);
}

console.log('\n' + '='.repeat(70));
console.log('✅ Tests completed\n');

process.exit(0);
