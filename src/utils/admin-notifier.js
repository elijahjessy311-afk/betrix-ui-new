/**
 * Admin notification helper - sends alerts to admin via Telegram
 * Call this when a payment cannot be matched to notify the admin
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('AdminNotifier');

export async function notifyUnmatchedPayment(bot, adminTelegramId, paymentData, source) {
  try {
    if (!bot || !adminTelegramId) {
      logger.warn('Bot or admin ID not configured for notifications');
      return;
    }

    const { Reference, TransactionID, Amount, Phone } = paymentData;
    const text = `⚠️ *Unmatched Payment Alert*

📊 *Source:* ${source}
💰 *Amount:* ${Amount}
📞 *Phone:* ${Phone || 'N/A'}
🔗 *Reference:* ${Reference || 'N/A'}
🔢 *Transaction:* ${TransactionID || 'N/A'}

👉 Please review at: /admin

_Timestamp:_ ${new Date().toISOString()}`;

    // Attempt to send via Telegram (if bot is available)
    try {
      await bot.telegram.sendMessage(adminTelegramId, text, { parse_mode: 'Markdown' });
    } catch (e) {
      logger.warn('Failed to send Telegram notification', e);
    }
  } catch (err) {
    logger.error('notifyUnmatchedPayment failed', err);
  }
}

export async function notifyPaymentVerified(bot, adminTelegramId, orderId, userId, tier) {
  try {
    if (!bot || !adminTelegramId) return;

    const text = `✅ *Payment Verified*

📋 *Order:* ${orderId.substring(0, 20)}...
👤 *User:* ${userId}
🎁 *Tier:* ${tier}
⏰ *Time:* ${new Date().toISOString()}`;

    try {
      await bot.telegram.sendMessage(adminTelegramId, text, { parse_mode: 'Markdown' });
    } catch (e) {
      logger.warn('Failed to send verification notification', e);
    }
  } catch (err) {
    logger.error('notifyPaymentVerified failed', err);
  }
}
