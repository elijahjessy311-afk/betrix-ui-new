# BETRIX Telegram Bot - Complete Audit & Redesign

**Date**: November 26, 2025
**Status**: Planning Phase

## 1. Current Structure Audit

### Active Handler Files
- `src/handlers/telegram-handler-v2.js` (845 lines) - Main handler, commands + callbacks
- `src/handlers/menu-handler.js` (365 lines) - Menu definitions and formatters
- `src/handlers/payment-router.js` (476 lines) - Payment creation and routing
- `src/handlers/payment-webhook.js` - Webhook handlers for providers
- `src/handlers/nl-parser.js` - Natural language intent parsing
- `src/worker.js` (5198 lines) - Monolithic worker with all logic inline

### Legacy/Duplicate Files
- `src/worker-final.js`, `src/worker-complete.js`, `src/worker-db.js`, etc. - Old workers
- `src/handlers.js` - Old handler class (replaced by telegram-handler-v2)
- Multiple tmp test files

---

## 2. Command Inventory

### Commands Currently Implemented
| Command | Handler | Status | Required Input | Output |
|---------|---------|--------|-----------------|--------|
| `/start` | telegram-handler-v2 | ✅ | - | Welcome + mainMenu |
| `/menu` | telegram-handler-v2 | ✅ | - | mainMenu |
| `/help` | telegram-handler-v2 | ✅ | - | helpMenu |
| `/live` | telegram-handler-v2 | ✅ | [sport] | Live matches + buttons |
| `/odds` | telegram-handler-v2 | ✅ | [fixtureId] | Odds + analysis |
| `/standings` | telegram-handler-v2 | ✅ | [league] | League table |
| `/news` | telegram-handler-v2 | ✅ | - | Latest news |
| `/profile` | telegram-handler-v2 | ✅ | - | profileMenu |
| `/vvip` / `/subscribe` | telegram-handler-v2 | ✅ | - | subscriptionMenu |
| `/pricing` | telegram-handler-v2 | ✅ | - | Tier pricing table |

### Menu Callbacks
| Callback | Handler | Input | Output |
|----------|---------|-------|--------|
| `menu_*` | handleMenuCallback | data | Menu text + buttons |
| `sport_*` | handleSportCallback | sport | Sport-specific view |
| `sub_*` | handleSubscriptionCallback | tier | Subscription + pay methods |
| `pay_*` | handlePaymentMethodSelection | method | Payment instructions |
| `profile_*` | handleProfileCallback | - | Profile sub-menu |
| `help_*` | handleHelpCallback | - | Help content |

### Payment Callbacks
| Callback | Flow | Status |
|----------|------|--------|
| `pay_till` | Safaricom Till → order creation → instructions | ✅ |
| `pay_mpesa` | M-Pesa STK → order creation → instructions | ✅ |
| `pay_paypal` | PayPal Checkout → order creation → URL | ✅ |
| `pay_binance` | Binance SDK → order creation | ⚠️ Needs testing |

---

## 3. Issues & Gaps

### Code Quality
- ✗ Monolithic `worker.js` (5k+ lines) - hard to maintain
- ✗ Duplicate/legacy worker files scattered
- ✗ No clear separation of concerns

### UX/Functionality
- ✗ Payment flow doesn't show till number visually in subscription menu
- ✗ No inline payment status checking after user initiates payment
- ✗ Callback responses don't show clear next steps
- ✗ Error messages are generic
- ✗ No confirmation screens before payment

### Testing
- ✗ No end-to-end tests for command outputs
- ✗ No payment simulation tests
- ✗ No NLP intent testing

---

## 4. Redesign Plan

### Phase 1: Consolidate Handlers (THIS TASK)
**Goal**: Create a clean, modular telegram bot handler with zero duplication

**Files to create/update**:
1. `src/handlers/telegram-handler.js` (consolidated)
   - Merge telegram-handler-v2 + nl-parser
   - Clear command router
   - Clean callback dispatcher
   - Inline logger

2. `src/handlers/commands.js` (NEW)
   - Separate handler for each command
   - Consistent signatures
   - Error handling

3. `src/handlers/callbacks.js` (NEW)
   - Menu callbacks
   - Payment flow callbacks
   - Profile/help callbacks

4. `src/handlers/menu-system.js` (REFACTOR)
   - Consolidate menu-handler.js
   - Add payment-specific menus
   - Add tier-aware menus

### Phase 2: Payment Flow Redesign
**Goal**: Crystal-clear payment UX with status tracking

**Changes**:
1. Add confirmation screen before payment
2. Show till number prominently in subscription menu
3. Add "Check Payment Status" button after initiation
4. Add webhook verification feedback

### Phase 3: Testing & Validation
**Goal**: Test every command and flow end-to-end

**Approach**:
1. Create `tests/telegram-bot.test.js`
2. Mock Telegram API + Redis
3. Test each command with various inputs
4. Validate payment flow callbacks

---

## 5. Success Criteria

- ✅ All commands work without error
- ✅ Payment flow is clear and user-friendly
- ✅ No duplicate code across handlers
- ✅ Each command output matches expected format
- ✅ All callbacks execute correctly
- ✅ Tier restrictions properly enforced
- ✅ Error messages are helpful

---

## 6. Timeline
- **Audit** (DONE): 30 min
- **Consolidate handlers**: 2 hours
- **Redesign payment UX**: 1 hour
- **Test all commands**: 1 hour
- **Final polish**: 30 min

**Total**: ~5 hours

---

This document will be updated as work progresses.
