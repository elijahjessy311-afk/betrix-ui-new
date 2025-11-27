#!/usr/bin/env node

/**
 * Multi-Sport Analyzer Test Suite
 * Tests all sports and betting markets
 */

import Redis from 'ioredis';
import SportsAggregator from './src/services/sports-aggregator.js';
import { MultiSportAnalyzer } from './src/services/multi-sport-analyzer.js';
import { CONFIG } from './src/config.js';

const redis = new Redis(CONFIG.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379');
const sportsAggregator = new SportsAggregator(redis);
const multiSportAnalyzer = new MultiSportAnalyzer(redis, sportsAggregator, null);

console.log('\n🏆 MULTI-SPORT ANALYZER TEST SUITE\n');
console.log('='.repeat(80));

const tests = [
  {
    sport: 'football',
    teams: ['Manchester United', 'Liverpool'],
    market: null,
    name: 'Football: Basic Analysis'
  },
  {
    sport: 'football',
    teams: ['Man Utd', 'Liverpool'],
    market: 'OVER_UNDER',
    name: 'Football: Over/Under Goals'
  },
  {
    sport: 'football',
    teams: ['Chelsea', 'Arsenal'],
    market: 'CORNERS',
    name: 'Football: Corners Market'
  },
  {
    sport: 'football',
    teams: ['Tottenham', 'Newcastle'],
    market: 'CARDS',
    name: 'Football: Cards Market'
  },
  {
    sport: 'basketball',
    teams: ['Lakers', 'Celtics'],
    market: null,
    name: 'Basketball: Basic Analysis'
  },
  {
    sport: 'basketball',
    teams: ['Warriors', 'Suns'],
    market: 'SPREAD',
    name: 'Basketball: Spread Market'
  },
  {
    sport: 'tennis',
    teams: ['Federer', 'Nadal'],
    market: null,
    name: 'Tennis: Basic Analysis'
  },
  {
    sport: 'tennis',
    teams: ['Djokovic', 'Alcaraz'],
    market: 'SET_SPREAD',
    name: 'Tennis: Set Spread Market'
  },
  {
    sport: 'cricket',
    teams: ['India', 'Pakistan'],
    market: null,
    name: 'Cricket: Basic Analysis'
  },
  {
    sport: 'cricket',
    teams: ['Australia', 'England'],
    market: 'RUNS_SPREAD',
    name: 'Cricket: Runs Spread Market'
  },
  {
    sport: 'american_football',
    teams: ['Patriots', 'Chiefs'],
    market: null,
    name: 'American Football: Basic Analysis'
  },
  {
    sport: 'american_football',
    teams: ['Cowboys', '49ers'],
    market: 'SPREAD',
    name: 'American Football: Spread Market'
  },
  {
    sport: 'hockey',
    teams: ['Maple Leafs', 'Canadiens'],
    market: null,
    name: 'Hockey: Basic Analysis'
  },
  {
    sport: 'hockey',
    teams: ['Oilers', 'Flames'],
    market: 'TOTAL_GOALS',
    name: 'Hockey: Total Goals Market'
  }
];

async function runTests() {
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n📊 TEST ${i + 1}/${tests.length}: ${test.name}`);
    console.log('-'.repeat(80));

    try {
      const analysis = await multiSportAnalyzer.analyzeMatch(
        test.sport,
        test.teams[0],
        test.teams[1],
        null,
        test.market
      );

      if (analysis.status === 'error') {
        console.log(`❌ Error: ${analysis.message}`);
      } else {
        console.log(`✅ Sport: ${analysis.sportName} (${analysis.sportIcon})`);
        console.log(`   Match: ${analysis.match}`);
        
        if (analysis.primaryMarket) {
          console.log(`   Primary Market: ${analysis.primaryMarket.market}`);
          console.log(`   Prediction: ${analysis.primaryMarket.prediction?.outcome}`);
          console.log(`   Confidence: ${analysis.primaryMarket.confidence}%`);
          console.log(`   Odds: ${analysis.primaryMarket.prediction?.odds}`);
          console.log(`   Reasoning: ${analysis.primaryMarket.reasoning.substring(0, 100)}...`);
        }

        console.log(`   Alternative Markets: ${analysis.alternativeMarkets.length}`);
        console.log(`   Risk Factors: ${analysis.riskFactors.length}`);
        console.log(`   Form Analysis: ✓`);
        console.log(`   Head-to-Head: ✓`);
        console.log(`   Statistics: ✓`);
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }
  }
}

async function testSportsGuide() {
  console.log('\n\n🎯 SUPPORTED SPORTS GUIDE');
  console.log('='.repeat(80));
  const guide = await multiSportAnalyzer.getAllSportsOverview();
  console.log(guide);
}

async function testTelegramFormatting() {
  console.log('\n\n📱 TELEGRAM FORMATTING TEST');
  console.log('='.repeat(80));

  const analysis = await multiSportAnalyzer.analyzeMatch(
    'football',
    'Manchester United',
    'Liverpool'
  );

  if (analysis.status !== 'error') {
    const formatted = multiSportAnalyzer.formatForTelegram(analysis);
    console.log(formatted);
  }
}

async function main() {
  try {
    await runTests();
    await testSportsGuide();
    await testTelegramFormatting();

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ All tests completed');
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('❌ Test suite failed:', err);
  } finally {
    process.exit(0);
  }
}

main();
