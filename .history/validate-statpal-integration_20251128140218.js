#!/usr/bin/env node

/**
 * StatPal Integration Validation Script
 * 
 * Runs comprehensive checks to verify StatPal integration is working
 * Usage: node validate-statpal-integration.js
 */

const CONFIG = require('./src/config');
const StatPalService = require('./src/services/statpal-service');
const MultiSportHandler = require('./src/services/multi-sport-handler');
const logger = require('./src/utils/logger');

const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
};

function log(type, message) {
  const timestamp = new Date().toISOString().substr(11, 8);
  const typeStr = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '⚠️';
  console.log(`[${timestamp}] ${typeStr} ${message}`);
}

async function validateConfiguration() {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}1. CONFIGURATION CHECK${COLORS.RESET}\n`);

  // Check API Key
  if (CONFIG.STATPAL && CONFIG.STATPAL.KEY) {
    const masked = CONFIG.STATPAL.KEY.substring(0, 8) + '****' + CONFIG.STATPAL.KEY.substring(CONFIG.STATPAL.KEY.length - 4);
    log('success', `API Key configured: ${masked}`);
  } else {
    log('error', 'API Key NOT configured. Set STATPAL_API_KEY environment variable.');
    return false;
  }

  // Check Base URL
  if (CONFIG.STATPAL && CONFIG.STATPAL.BASE) {
    log('success', `Base URL: ${CONFIG.STATPAL.BASE}`);
  } else {
    log('error', 'Base URL not configured');
    return false;
  }

  return true;
}

async function validateServiceInstantiation() {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}2. SERVICE INSTANTIATION CHECK${COLORS.RESET}\n`);

  try {
    const statpal = new StatPalService();
    log('success', 'StatPalService instantiated successfully');

    const handler = new MultiSportHandler();
    log('success', 'MultiSportHandler instantiated successfully');

    return { statpal, handler };
  } catch (error) {
    log('error', `Service instantiation failed: ${error.message}`);
    return null;
  }
}

async function validateSportsList() {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}3. SUPPORTED SPORTS CHECK${COLORS.RESET}\n`);

  const sports = StatPalService.getAvailableSports();
  log('success', `${sports.length} sports supported:`);
  
  console.log('   ' + sports.join(', '));
  return true;
}

async function validateAPIEndpoints(statpal) {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}4. API ENDPOINTS VALIDATION${COLORS.RESET}\n`);

  const tests = [
    { name: 'Soccer Live Scores', fn: () => statpal.getLiveScores('soccer', 'v1') },
    { name: 'Soccer Odds', fn: () => statpal.getLiveOdds('soccer', 'v1') },
    { name: 'Soccer Fixtures', fn: () => statpal.getFixtures('soccer', 'v1') },
    { name: 'Soccer Standings', fn: () => statpal.getStandings('soccer', null, 'v1') },
    { name: 'Soccer Injuries', fn: () => statpal.getInjuries('soccer', 'v1') },
    { name: 'Soccer Results', fn: () => statpal.getResults('soccer', 'v1') },
    { name: 'Soccer Scoring Leaders', fn: () => statpal.getScoringLeaders('soccer', 'v1') },
    { name: 'NFL Live Scores', fn: () => statpal.getLiveScores('nfl', 'v1') },
    { name: 'NBA Live Scores', fn: () => statpal.getLiveScores('nba', 'v1') },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const startTime = Date.now();
      const result = await test.fn();
      const responseTime = Date.now() - startTime;
      const dataCount = Array.isArray(result) ? result.length : (result ? 1 : 0);
      
      log('success', `${test.name} - ${responseTime}ms - ${dataCount} data points`);
      passed++;
    } catch (error) {
      log('error', `${test.name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n   Result: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

async function validateHealthCheck(statpal) {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}5. HEALTH CHECK${COLORS.RESET}\n`);

  try {
    const startTime = Date.now();
    const isHealthy = await statpal.healthCheck();
    const responseTime = Date.now() - startTime;

    if (isHealthy) {
      log('success', `StatPal API is healthy (${responseTime}ms)`);
      return true;
    } else {
      log('error', 'StatPal API health check failed');
      return false;
    }
  } catch (error) {
    log('error', `Health check error: ${error.message}`);
    return false;
  }
}

async function validateMultiSportHandler(handler) {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}6. MULTI-SPORT HANDLER VALIDATION${COLORS.RESET}\n`);

  try {
    const startTime = Date.now();
    const allSports = await handler.getAllSportsLive({
      sports: ['soccer', 'nfl', 'nba'],
      limit: 5
    });
    const responseTime = Date.now() - startTime;

    let totalMatches = 0;
    let successCount = 0;

    for (const [sport, result] of Object.entries(allSports)) {
      if (result.status === 'success') {
        log('success', `${sport}: ${result.count} live matches`);
        successCount++;
        totalMatches += result.count;
      } else {
        log('error', `${sport}: ${result.error}`);
      }
    }

    console.log(`\n   Total: ${totalMatches} matches across ${successCount} sports (${responseTime}ms)`);
    return successCount > 0;
  } catch (error) {
    log('error', `Multi-sport handler error: ${error.message}`);
    return false;
  }
}

async function validateDeploymentReadiness() {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}7. DEPLOYMENT READINESS${COLORS.RESET}\n`);

  const checks = [
    { name: 'StatPalService module', path: './src/services/statpal-service.js' },
    { name: 'MultiSportHandler module', path: './src/services/multi-sport-handler.js' },
    { name: 'SportsAggregator integration', path: './src/services/sports-aggregator.js' },
  ];

  let ready = true;

  for (const check of checks) {
    try {
      require(check.path);
      log('success', `${check.name} present and loadable`);
    } catch (error) {
      log('error', `${check.name} - ${error.message}`);
      ready = false;
    }
  }

  return ready;
}

async function generateReport(results) {
  console.log(`\n${COLORS.BLUE}${COLORS.BRIGHT}VALIDATION REPORT${COLORS.RESET}\n`);

  const allPassed = Object.values(results).every(r => r);
  const passCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.keys(results).length;

  console.log(`Status: ${allPassed ? COLORS.GREEN + '✅ ALL CHECKS PASSED' : COLORS.RED + '❌ SOME CHECKS FAILED'}${COLORS.RESET}`);
  console.log(`Passed: ${passCount}/${totalCount}`);
  console.log('\nDetails:');
  
  Object.entries(results).forEach(([name, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${name}`);
  });

  return allPassed;
}

async function main() {
  console.log(`\n${COLORS.BRIGHT}${COLORS.BLUE}╔════════════════════════════════════════════╗${COLORS.RESET}`);
  console.log(`${COLORS.BRIGHT}${COLORS.BLUE}║   StatPal Integration Validation Script    ║${COLORS.RESET}`);
  console.log(`${COLORS.BRIGHT}${COLORS.BLUE}╚════════════════════════════════════════════╝${COLORS.RESET}\n`);

  const results = {};

  // Run validation checks
  results['Configuration'] = await validateConfiguration();
  
  if (!results['Configuration']) {
    log('error', 'Configuration check failed. Cannot proceed.');
    process.exit(1);
  }

  const services = await validateServiceInstantiation();
  results['Service Instantiation'] = services !== null;

  if (services) {
    results['Supported Sports'] = await validateSportsList();
    results['API Endpoints'] = await validateAPIEndpoints(services.statpal);
    results['Health Check'] = await validateHealthCheck(services.statpal);
    results['Multi-Sport Handler'] = await validateMultiSportHandler(services.handler);
  }

  results['Deployment Readiness'] = await validateDeploymentReadiness();

  // Generate report
  const allPassed = await generateReport(results);

  if (allPassed) {
    console.log(`\n${COLORS.GREEN}${COLORS.BRIGHT}✅ READY FOR DEPLOYMENT${COLORS.RESET}\n`);
    console.log(`${COLORS.GREEN}Next steps:${COLORS.RESET}`);
    console.log(`1. Commit changes to git`);
    console.log(`2. Push to Render: git push origin main`);
    console.log(`3. Render auto-deploys the changes`);
    console.log(`4. Verify in Render logs: https://dashboard.render.com\n`);
    process.exit(0);
  } else {
    console.log(`\n${COLORS.RED}${COLORS.BRIGHT}❌ VALIDATION FAILED${COLORS.RESET}\n`);
    console.log(`${COLORS.RED}Issues to fix:${COLORS.RESET}`);
    console.log(`1. Review failed checks above`);
    console.log(`2. Check API key configuration`);
    console.log(`3. Verify network connectivity`);
    console.log(`4. Check error logs for details\n`);
    process.exit(1);
  }
}

// Run validation
main().catch((error) => {
  console.error(`\n${COLORS.RED}Fatal error:${COLORS.RESET}`, error.message);
  process.exit(1);
});
