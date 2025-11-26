/**
 * BETRIX v3 Integration Guide
 * How to wire v3 handlers into the existing webhook dispatcher
 * 
 * This guide shows the migration path from v2 to v3 handlers.
 */

// ============================================================================
// CURRENT FLOW (v2)
// ============================================================================

/*
telegram-handler-v2.js (webhook entry)
  ↓
  ├─ message.text
  │   ├─ starts with "/" → handleCommand() (commands.js)
  │   └─ natural text → placeholder or error
  │
  └─ callback_query.data
      └─ handleCallbackQuery() (callbacks.js)

Current issues:
- commands.js doesn't handle natural language
- callbacks.js has scattered callback handlers
- No state machine for multi-turn flows (signup)
- No unified data models or Redis schema
*/

// ============================================================================
// NEW FLOW (v3)
// ============================================================================

/*
telegram-handler-v2.js (webhook entry) - MINIMAL CHANGES
  ↓
  ├─ message.text
  │   └─ handleMessage(text, userId, chatId, redis, services)
  │       from message-handler-v3.js
  │       ├─ parseMessage() → command or natural text
  │       ├─ checkUserState() → signup, payment, betting, etc
  │       ├─ if state: handleStateSpecificInput() → collect name/country/age
  │       └─ else: route to command or classify intent
  │
  └─ callback_query.data
      └─ handleCallbackQuery(data, userId, chatId, redis, services)
          from callbacks-v3.js
          ├─ menu_* → handleMenuCallback()
          ├─ pay_* → payment-router.js
          ├─ vvip_* → handleVVIPCallback()
          ├─ sites_* → betting-sites.js
          ├─ help_* → handleHelpCallback()
          ├─ odds_* → handleOddsCallback()
          ├─ analyze_* → handleAnalyzeCallback()
          ├─ news_* → handleNewsCallback()
          ├─ bet_* → handleBettingCallback()
          └─ signup_* → handleSignupCallback()

Benefits:
✅ Single intent routing (commands + natural language)
✅ State machine for multi-turn workflows
✅ Unified callback dispatcher
✅ Centralized data models + Redis schema
✅ Easier to extend with new features
*/

// ============================================================================
// INTEGRATION STEPS
// ============================================================================

/*
Step 1: Update telegram-handler-v2.js message handler
- Replace handleMessage() call with message-handler-v3.js
- Pass redis and services to message handler

OLD:
async function handleMessage(message) {
  if (message.startsWith('/')) {
    return await handleCommand(message, userId, chatId);
  }
  return null; // Unsupported
}

NEW:
import { handleMessage as handleMessageV3 } from './message-handler-v3.js';

async function handleMessage(message) {
  return await handleMessageV3(message, userId, chatId, redis, services);
}

---

Step 2: Update telegram-handler-v2.js callback handler
- Replace handleCallbackQuery() with callbacks-v3.js
- Pass redis and services to callback handler

OLD:
async function handleCallbackQuery(data) {
  if (data.startsWith('menu_')) return handleMenuCallback(data);
  if (data.startsWith('pay_')) return handlePaymentCallback(data);
  // ... scattered handlers
}

NEW:
import { handleCallbackQuery as handleCallbackQueryV3 } from './callbacks-v3.js';

async function handleCallbackQuery(data) {
  return await handleCallbackQueryV3(data, userId, chatId, redis, services);
}

---

Step 3: Delete old handlers (or keep as backup)
- Delete: src/handlers/commands.js (replaced by commands-v3.js)
- Delete: src/handlers/callbacks.js (replaced by callbacks-v3.js)
- Keep: src/handlers/telegram-handler-v2.js (only minimal changes)
- Keep: src/handlers/payment-router.js (enhanced, imported by v3)
- Keep: src/handlers/menu-system.js (formatters, used by v3)

---

Step 4: Test integration
- Run local tests: node --test tests/*.js
- Run e2e simulation: node scripts/e2e-simulate.js (update to use v3 handlers)
- Manual testing on Telegram bot
  - /start → check welcome
  - /signup → test profile collection
  - /menu → check main menu buttons
  - /odds → test odds display
  - /vvip → test VVIP tiers
  - /pay → test payment hub
  - /help → test help menu
  - "Show odds" → test natural language routing
  - "I want to join" → test intent classification
- Test callbacks (button taps):
  - Menu buttons
  - Payment method selection
  - VVIP tier selection
  - Betting sites links
  - Help topics

---

Step 5: Deploy to Render
- Push commits to main (done ✅)
- Trigger Render redeploy
- Monitor logs: check for errors in handlers
- Test bot on production Telegram
- Monitor webhook health: /health, /ready endpoints

---

Step 6: Monitor & iterate
- Check user signups: /start → /signup → payment
- Monitor VVIP subscriptions: /vvip → payment flow
- Track prediction accuracy: /analyze → post-match verification
- Collect feedback from users
- Iterate: add features, fix bugs, improve UX
*/

// ============================================================================
// MINIMAL TELEGRAM-HANDLER-V2.JS CHANGES
// ============================================================================

/*
File: src/handlers/telegram-handler-v2.js

Required imports (add these):
import { handleMessage } from './message-handler-v3.js';
import { handleCallbackQuery } from './callbacks-v3.js';

Replace existing message handler:

// OLD
async function handleTelegramMessage(message, userId, chatId) {
  if (!message) return null;
  if (message.startsWith('/')) {
    return await handleCommand(message, userId, chatId);
  }
  // Fallback: no support for natural language
  return null;
}

// NEW
async function handleTelegramMessage(message, userId, chatId) {
  if (!message) return null;
  // v3 handles both commands and natural language
  return await handleMessage(message, userId, chatId, redis, services);
}

Replace existing callback handler:

// OLD
async function handleTelegramCallback(data, userId, chatId) {
  if (data.startsWith('menu_')) return handleMenuCallback(data);
  if (data.startsWith('pay_')) return handlePaymentCallback(data);
  // ... scattered handlers
}

// NEW
async function handleTelegramCallback(data, userId, chatId) {
  // v3 unified dispatcher handles all callbacks
  return await handleCallbackQuery(data, userId, chatId, redis, services);
}

That's it! The rest of telegram-handler-v2.js stays the same.
*/

// ============================================================================
// DATA MODELS - REDIS SETUP
// ============================================================================

/*
v3 introduces structured Redis keys. No schema migration needed if starting fresh.
Existing data (users, payments) from v2 should still work; just start v3 operations
in parallel.

Key naming convention:
- user:{userId} → user profile (hash)
- signup_state:{userId} → signup step (string)
- signup_data:{userId} → signup form data (hash)
- payment:{paymentId} → payment record (hash)
- order:{orderId} → same payment record (hash, dual-keyed)
- user:{userId}:payments → list of payment IDs
- ai_output:{queryId} → cached AI output (hash)
- user:{userId}:ai_outputs → list of AI output IDs
- user:{userId}:state → current state (string)
- user:{userId}:state_data → state-specific data (hash)
- odds:{fixtureId} → cached fixture odds (hash)

If you need to migrate v2 → v3 user data:
- Read v2 `user:{userId}` hashes
- Transform to v3 schema (add missing fields with defaults)
- Re-write to v3 format
- Update indices/lists as needed

No downtime required; v3 coexists with v2 data.
*/

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

/*
Unit Tests (node --test tests/*.js):
- ✅ All existing tests pass
- ✅ Add tests for message-handler-v3.js:
  - classifyIntent() with various user inputs
  - parseMessage() for commands vs natural text
  - handleStateSpecificInput() for signup flow
- ✅ Add tests for callbacks-v3.js:
  - Each callback type (menu, pay, vvip, help, odds, analyze, news, bet)
  - State transitions
- ✅ Add tests for data-models.js:
  - createUserProfile(), getUserProfile()
  - createPaymentRecord(), getPaymentByOrderId()
  - cacheAIOutput(), cacheFixtureOdds()

E2E Simulation (scripts/e2e-simulate.js):
- Simulate /start → show welcome
- Simulate /signup → collect name, country, age
- Simulate /menu → show main menu
- Simulate /odds → show today's fixtures
- Simulate /analyze {fixtureId} → show AI prediction
- Simulate /vvip → show VVIP tiers
- Simulate callback: menu_odds → show odds menu
- Simulate callback: pay_mpesa_signup → show M-Pesa payment
- Simulate callback: sites_main → show betting sites
- Simulate natural language: "Show odds" → route to /odds

Manual Telegram Testing:
- Join test bot (private)
- Send /start → see welcome + buttons
- Send /signup → guided profile collection
- Send /menu → see main menu with all buttons
- Send /odds → see today's fixtures + filters
- Send /analyze → prompt for fixture ID
- Send /vvip → see tier options
- Send /help → see FAQs
- Send "Show odds" → should route to /odds (intent classification)
- Send "I want to join" → should route to /signup
- Tap buttons on keyboard → test callback handlers
- Tap payment method → test payment flow
- Tap VVIP tier → test subscription flow

Performance & Load Testing:
- Simulate 100 concurrent users → check Redis connection pool
- Simulate 1000 /odds requests → check API rate limits
- Simulate 50 /analyze requests → check AI API quotas
- Monitor memory usage, CPU, latency
- Check error rates, timeouts, retries

Deployment Validation (Render):
- Deploy to staging env first (or branch)
- Run health checks: curl https://betrix.app/health
- Test webhook: send test message to Telegram bot
- Monitor logs for errors
- Verify payment webhooks (PayPal, M-Pesa test mode)
- Gradually roll out to production
*/

// ============================================================================
// ROLLBACK PLAN
// ============================================================================

/*
If v3 causes issues:

1. Revert commit: git revert {commit_hash}
2. Restore v2 handlers in telegram-handler-v2.js
3. Clear any v3 state from Redis: redis-cli KEYS "signup_state:*" | xargs redis-cli DEL
4. Monitor bot on Telegram
5. Investigate root cause
6. Fix in v3 code
7. Test locally before re-deploying

Safest approach: test v3 on a staging environment first.
*/

// ============================================================================
// NOTES
// ============================================================================

/*
1. v3 is backward-compatible with v2 data models.
2. Existing user profiles, payments, and history continue to work.
3. v3 adds new Redis keys; old keys are untouched.
4. State machine only applies to NEW workflows (signup, multi-turn flows).
5. Payment router remains largely unchanged; just imported by v3.
6. Natural language routing is NEW; old commands still work.
7. No breaking changes for end users.
8. Deploy with confidence; can rollback if needed.

Questions? Check:
- BETRIX_V3_ARCHITECTURE.md (this file explains the complete design)
- src/handlers/commands-v3.js (implementation of 9 commands)
- src/handlers/message-handler-v3.js (intent classification + state machine)
- src/handlers/callbacks-v3.js (unified callback router)
- src/handlers/data-models.js (Redis schemas + helpers)
- src/handlers/betting-sites.js (Kenya bookmaker directory)
*/

export default { /* Integration guide - documentation only */ };
