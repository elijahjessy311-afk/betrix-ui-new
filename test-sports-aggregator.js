import Redis from 'ioredis';
import SportsAggregator from './src/services/sports-aggregator.js';
import { CONFIG } from './src/config.js';

const redisClient = new Redis(CONFIG.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379');

const sportsAggregator = new SportsAggregator(redisClient);

console.log('\n🏟️  TESTING SPORTS AGGREGATOR\n');
console.log('='.repeat(70));

try {
  // Test 1: Get live matches
  console.log('\n📊 TEST 1: Fetching live matches\n');
  const liveMatches = await sportsAggregator.getLiveMatches();
  
  if (liveMatches && liveMatches.length > 0) {
    console.log(`✅ Found ${liveMatches.length} live matches\n`);
    liveMatches.slice(0, 3).forEach((match, idx) => {
      console.log(`⚽ Match ${idx + 1}: ${match.home} vs ${match.away}`);
      console.log(`   Score: ${match.homeScore} - ${match.awayScore}`);
      console.log(`   Status: ${match.status} | Time: ${match.time}`);
      console.log(`   Venue: ${match.venue}`);
      console.log();
    });
  } else {
    console.log('⚠️  No live matches found\n');
  }

  // Test 2: Format for Telegram display
  console.log('📊 TEST 2: Telegram formatting example\n');
  if (liveMatches && liveMatches.length > 0) {
    const match = liveMatches[0];
    const telegramFormat = `
⚽ <b>${match.home} vs ${match.away}</b>
📊 Score: <b>${match.homeScore} - ${match.awayScore}</b>
🕐 Time: ${match.time}
🏟️ Venue: ${match.venue}
📍 Status: ${match.status}
    `.trim();
    console.log('Example Telegram message:');
    console.log(telegramFormat);
  }

  // Test 3: Get odds (demo)
  console.log('\n📊 TEST 3: Fetching odds\n');
  const odds = await sportsAggregator.getOdds();
  
  if (odds && odds.length > 0) {
    console.log(`✅ Found ${odds.length} odds bookmakers\n`);
    odds.slice(0, 2).forEach((odd, idx) => {
      console.log(`💰 Odds ${idx + 1}: ${odd.home} vs ${odd.away}`);
      console.log(`   1X2: ${odd.homeOdds} - ${odd.drawOdds} - ${odd.awayOdds}`);
      console.log(`   Bookmaker: ${odd.bookmaker}`);
      console.log();
    });
  } else {
    console.log('⚠️  No odds found\n');
  }

  // Test 4: Get standings
  console.log('📊 TEST 4: Fetching standings\n');
  const standings = await sportsAggregator.getStandings();
  
  if (standings && standings.length > 0) {
    console.log(`✅ Found standings for ${standings.length} teams\n`);
    standings.slice(0, 5).forEach((team, idx) => {
      const name = team.name || team.team;
      console.log(`${team.position || idx + 1}. ${name}`);
      console.log(`   Played: ${team.played} | W: ${team.won || team.wins} | D: ${team.drawn || team.draws} | L: ${team.lost || team.losses}`);
      console.log(`   Points: ${team.points}`);
      console.log();
    });
  } else {
    console.log('⚠️  No standings found\n');
  }

  // Test 5: Display Telegram message formatting examples
  console.log('📊 TEST 5: How LIVE MATCHES will look in Telegram\n');
  console.log('┌' + '─'.repeat(68) + '┐');
  
  if (liveMatches && liveMatches.length >= 2) {
    const match1 = liveMatches[0];
    const match2 = liveMatches[1];
    
    const lines1 = [
      `⚽ <b>${match1.home} vs ${match1.away}</b>`,
      `📊 ${match1.homeScore} - ${match1.awayScore}`,
      `🕐 ${match1.time} | ${match1.status}`,
      `🏟️ ${match1.venue}`
    ];
    
    lines1.forEach(line => {
      console.log('│ ' + line + ' '.repeat(Math.max(0, 66 - line.length)) + '│');
    });
    console.log('│' + ' '.repeat(68) + '│');
    
    const lines2 = [
      `⚽ <b>${match2.home} vs ${match2.away}</b>`,
      `📊 ${match2.homeScore} - ${match2.awayScore}`,
      `🕐 ${match2.time} | ${match2.status}`,
      `🏟️ ${match2.venue}`
    ];
    
    lines2.forEach(line => {
      console.log('│ ' + line + ' '.repeat(Math.max(0, 66 - line.length)) + '│');
    });
  }
  
  console.log('└' + '─'.repeat(68) + '┘');

  // Test 6: Odds Display Format
  console.log('\n📊 TEST 6: How ODDS will look in Telegram\n');
  console.log('┌' + '─'.repeat(68) + '┐');
  
  if (odds && odds.length > 0) {
    const odd = odds[0];
    const lines = [
      `💰 <b>${odd.home} vs ${odd.away}</b>`,
      `1: ${odd.homeOdds} | X: ${odd.drawOdds} | 2: ${odd.awayOdds}`,
      `📍 Bookmaker: ${odd.bookmaker}`
    ];
    
    lines.forEach(line => {
      console.log('│ ' + line + ' '.repeat(Math.max(0, 66 - line.length)) + '│');
    });
  }
  
  console.log('└' + '─'.repeat(68) + '┘');

} catch (error) {
  console.error('❌ Test error:', error.message);
  console.error(error.stack);
}

console.log('\n' + '='.repeat(70));
console.log('✅ Tests completed\n');

process.exit(0);
