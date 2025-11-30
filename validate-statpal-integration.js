#!/usr/bin/env node

/**
 * StatPal scripts deprecated
 * StatPal is no longer used in this deployment. This script is kept for
 * historical reference and has been intentionally disabled.
 */

console.log('\n⚠️  StatPal integration scripts are deprecated and disabled.');
console.log('Use SportMonks and Football-Data verification tools instead.');
process.exit(0);

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
