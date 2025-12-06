#!/usr/bin/env node

/**
 * Complete Integration Test for BETRIX Bot
 * Tests: Branding, Signup Flow, Payment System, Live Games, Odds, Tier Gating
 */

import Redis from 'ioredis';
import { Logger } from './src/utils/logger.js';
import { TIERS, getUserSubscription } from './src/handlers/payment-handler.js';
import { PAYMENT_PROVIDERS, getTierPrice, parseTransactionMessage } from './src/handlers/payment-router.js';
import * as v2Handler from './src/handlers/telegram-handler-v2.js';
import { mainMenu, subscriptionMenu, welcomeNewUser, welcomeReturningUser } from './src/handlers/menu-handler.js';

const logger = new Logger('IntegrationTest');
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

let testsPassed = 0;
let testsFailed = 0;

function testResult(name, passed, message = '') {
  if (passed) {
    logger.info(`✅ PASS: ${name}`);
    testsPassed++;
  } else {
    logger.error(`❌ FAIL: ${name} - ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  logger.info('🚀 Starting Complete Integration Tests...\n');

  // Test 1: Branding
  logger.info('📌 TEST SUITE 1: BRANDING & MENUS');
  testResult('Main menu has BETRIX branding', mainMenu.text.includes('BETRIX'), `Text: ${mainMenu.text.substring(0, 50)}`);
  testResult('Main menu has Live Games button', JSON.stringify(mainMenu.reply_markup).includes('Live Games'));
  testResult('Main menu has Sign Up button', JSON.stringify(mainMenu.reply_markup).includes('Sign Up'));
  testResult('Main menu has Subscribe to VVIP button', JSON.stringify(mainMenu.reply_markup).includes('VVIP'));
  testResult('Welcome message for new user exists', typeof welcomeNewUser === 'function');
  testResult('Welcome message for returning user exists', typeof welcomeReturningUser === 'function');
  testResult('Subscription menu shows pricing', subscriptionMenu.text.includes('KES'));
  testResult('Subscription menu shows KES 150 signup concept', subscriptionMenu.text.includes('150'));
  testResult('Subscription menu has payment methods', subscriptionMenu.text.includes('Safaricom Till'));

  // Test 2: Payment System
  logger.info('\n💳 TEST SUITE 2: PAYMENT SYSTEM');
  testResult('TIERS are defined', Object.keys(TIERS).length > 0);
  testResult('TIERS has SIGNUP tier', TIERS['SIGNUP'] !== undefined);
  testResult('TIERS has VVIP tier', TIERS['VVIP'] !== undefined);
  testResult('TIERS has PRO tier', TIERS['PRO'] !== undefined);
  testResult('TIERS has PLUS tier', TIERS['PLUS'] !== undefined);
  testResult('PAYMENT_PROVIDERS has MPESA', PAYMENT_PROVIDERS['MPESA'] !== undefined);
  testResult('PAYMENT_PROVIDERS has SAFARICOM_TILL', PAYMENT_PROVIDERS['SAFARICOM_TILL'] !== undefined);
  testResult('PAYMENT_PROVIDERS has PAYPAL', PAYMENT_PROVIDERS['PAYPAL'] !== undefined);

  // Test 3: Tier Pricing
  logger.info('\n💰 TEST SUITE 3: TIER PRICING');
  const signupPrice = getTierPrice('SIGNUP', 'MPESA');
  testResult('SIGNUP tier has price', signupPrice !== undefined && signupPrice > 0, `Price: ${signupPrice}`);
  const vvipPrice = getTierPrice('VVIP', 'MPESA');
  testResult('VVIP tier has price', vvipPrice !== undefined && vvipPrice > 0, `Price: ${vvipPrice}`);
  const prosPrice = getTierPrice('PRO', 'MPESA');
  testResult('PRO tier has price', prosPrice !== undefined && prosPrice > 0, `Price: ${prosPrice}`);
  
  // Test 4: Handler Exports
  logger.info('\n📡 TEST SUITE 4: HANDLERS');
  testResult('v2Handler exports handleCallbackQuery', typeof v2Handler.handleCallbackQuery === 'function');
  testResult('v2Handler exports handleMessage', typeof v2Handler.handleMessage === 'function');
  testResult('v2Handler exports handleCommand', typeof v2Handler.handleCommand === 'function');

  // Test 5: Payment Verification
  logger.info('\n✅ TEST SUITE 5: PAYMENT VERIFICATION');
  const testUserId = 123456789;
  const testChatId = 123456789;
  
  try {
    // Create a test order
    const { createPaymentOrder } = await import('./src/handlers/payment-router.js');
    const order = await createPaymentOrder(redis, testUserId, 150, 'SAFARICOM_TILL', 'KE');
    testResult('Payment order creation works', order !== null && order.orderId !== undefined, `Order: ${JSON.stringify(order).substring(0, 100)}`);
    
    if (order) {
      // Test transaction message parsing
      const transactionText = 'Mpesa confirmation - Ref:LQQ2D2OX1N Amount:150.00 KES';
      const parsed = parseTransactionMessage(transactionText);
      testResult('Transaction message parsing works', parsed !== null && parsed.amount !== undefined, `Parsed: ${JSON.stringify(parsed)}`);
    }
  } catch (e) {
    testResult('Payment order creation works', false, e.message);
  }

  // Test 6: User Subscription
  logger.info('\n👤 TEST SUITE 6: USER SUBSCRIPTION & TIER GATING');
  try {
    // Test non-existent user (should be FREE tier)
    const subscription = await getUserSubscription(redis, testUserId);
    testResult('Default user has FREE tier', subscription.tier === 'FREE', `Tier: ${subscription.tier}`);
    
    // Save a VVIP user
    await redis.hset(`user:${testUserId}:subscription`, 'tier', 'VVIP');
    await redis.hset(`user:${testUserId}:subscription`, 'expiresAt', Date.now() + 30 * 24 * 60 * 60 * 1000);
    const vvipSub = await getUserSubscription(redis, testUserId);
    testResult('User can be set to VVIP tier', vvipSub.tier === 'VVIP', `Tier: ${vvipSub.tier}`);
  } catch (e) {
    testResult('User subscription gating works', false, e.message);
  }

  // Test 7: Command Handling
  logger.info('\n🎮 TEST SUITE 7: COMMAND HANDLERS');
  try {
    const mockServices = {
      openLiga: null,
      footballData: null,
      rss: null,
      scrapers: null,
      sportsAggregator: null,
      oddsAnalyzer: null,
      multiSportAnalyzer: null,
      cache: null
    };
    
    const startCmd = await v2Handler.handleCommand('/start', testChatId, testUserId, redis, mockServices);
    testResult('/start command returns menu', startCmd !== null && startCmd.text !== undefined);
    testResult('/start command includes BETRIX branding', startCmd.text.includes('BETRIX'));
    
    const menuCmd = await v2Handler.handleCommand('/menu', testChatId, testUserId, redis, mockServices);
    testResult('/menu command works', menuCmd !== null && menuCmd.text !== undefined);
    
    const liveCmd = await v2Handler.handleCommand('/live', testChatId, testUserId, redis, mockServices);
    testResult('/live command works', liveCmd !== null && liveCmd.text !== undefined);
    
    const oddsCmd = await v2Handler.handleCommand('/odds', testChatId, testUserId, redis, mockServices);
    testResult('/odds command works', oddsCmd !== null && oddsCmd.text !== undefined);
    
    const signupCmd = await v2Handler.handleCommand('/signup', testChatId, testUserId, redis, mockServices);
    testResult('/signup command initiates onboarding', signupCmd !== null && signupCmd.text.includes('Welcome'));
    
    const pricingCmd = await v2Handler.handleCommand('/pricing', testChatId, testUserId, redis, mockServices);
    testResult('/pricing command shows subscription menu', pricingCmd !== null && pricingCmd.text.includes('KES'));
  } catch (e) {
    testResult('Command handlers work', false, e.message);
    logger.error('Command test error:', e);
  }

  // Test 8: Callback Routing
  logger.info('\n🔘 TEST SUITE 8: CALLBACK ROUTING');
  try {
    const mockServices = {
      openLiga: null,
      footballData: null,
      rss: null,
      scrapers: null,
      sportsAggregator: null,
      oddsAnalyzer: null,
      multiSportAnalyzer: null,
      cache: null
    };

    const mockCallback = {
      id: 'test_callback_123',
      from: { id: testUserId },
      message: { chat: { id: testChatId } },
      data: 'menu_main'
    };
    
    const mainMenuResult = await v2Handler.handleCallbackQuery(mockCallback, redis, mockServices);
    testResult('menu_main callback works', mainMenuResult !== null && mainMenuResult.text !== undefined);
    testResult('menu_main includes BETRIX branding', mainMenuResult.text.includes('BETRIX'));

    // Test subscription callback
    mockCallback.data = 'sub_vvip';
    const subResult = await v2Handler.handleCallbackQuery(mockCallback, redis, mockServices);
    testResult('sub_vvip callback saves pending tier', subResult !== null);

    // Test sport selection
    mockCallback.data = 'sport_football';
    const sportResult = await v2Handler.handleCallbackQuery(mockCallback, redis, mockServices);
    testResult('sport_football callback works', sportResult !== null && sportResult.text !== undefined);
  } catch (e) {
    testResult('Callback routing works', false, e.message);
    logger.error('Callback test error:', e);
  }

  // Summary
  logger.info('\n' + '='.repeat(60));
  logger.info(`📊 TEST SUMMARY`);
  logger.info(`✅ Passed: ${testsPassed}`);
  logger.error(`❌ Failed: ${testsFailed}`);
  logger.info(`Total:  ${testsPassed + testsFailed}`);
  logger.info('='.repeat(60));

  // Cleanup
  try {
    await redis.del(`user:${testUserId}`);
    await redis.del(`user:${testUserId}:subscription`);
    await redis.del(`user:${testUserId}:onboarding`);
  } catch (e) {
    logger.warn('Cleanup failed', e);
  }

  await redis.quit();

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(err => {
  logger.error('Test suite error', err);
  process.exit(1);
});
