/**
 * Safaricom Till Number Payment Service
 * Direct till number integration for BETRIX
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("SafaricomTill");

class SafaricomTillService {
  constructor(redis, config) {
    this.redis = redis;
    this.config = config;
    this.tillNumber = config.MPESA.TILL || process.env.MPESA_TILL || process.env.SAFARICOM_TILL_NUMBER || "606215";
    this.accountName = config.MPESA.ACCOUNT || "BETRIX";
  }

  /**
   * Get Safaricom till payment instructions
   */
  getTillPaymentInstructions(amount, tier = "member") {
    const tierNames = {
      member: "Member Access",
      vvip_day: "VVIP Daily",
      vvip_week: "VVIP Weekly",
      vvip_month: "VVIP Monthly",
    };

    const text =
      `📱 <b>Safaricom Till Payment</b>\n\n` +
      `Follow these steps:\n\n` +
      `1️⃣ Go to your M-Pesa menu\n` +
      `2️⃣ Select "Lipa na M-Pesa"\n` +
      `3️⃣ Select "Till Number"\n` +
      `4️⃣ Enter Till: <code>${this.tillNumber}</code>\n` +
      `5️⃣ Enter Amount: <code>KES ${amount}</code>\n` +
      `6️⃣ Enter Account: <code>${this.accountName} - ${tierNames[tier] || "BETRIX"}</code>\n` +
      `7️⃣ Enter your M-Pesa PIN\n` +
      `8️⃣ Confirmation sent\n\n` +
      `✅ Access activated instantly\n\n` +
      `📞 Having trouble? Contact support`;

    return text;
  }

  /**
   * Get till payment details for reference
   */
  getTillDetails() {
    return {
      till_number: this.tillNumber,
      business_name: "BETRIX",
      account_name: this.accountName,
      method: "M-Pesa Lipa na M-Pesa Till",
      instructions: "M-Pesa Menu > Lipa na M-Pesa > Till Number",
      support: "Instant activation",
    };
  }

  /**
   * Build till payment button
   */
  buildTillPaymentButton(amount, tier = "member") {
    return {
      inline_keyboard: [
        [{ text: "📱 Use Safaricom Till", callback_data: `pay:till:${tier}:${amount}` }],
        [{ text: "💳 Other Methods", callback_data: "pay:methods" }],
        [{ text: "⬅️ Back", callback_data: "menu:pricing" }],
      ],
    };
  }

  /**
   * Record till payment for manual verification
   */
  async recordTillPayment(userId, amount, tier, referenceCode = null) {
    try {
      const key = `payment:till:${userId}`;
      const payment = {
        userId,
        amount,
        tier,
        reference: referenceCode || `TILL-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      await this.redis.setex(key, 86400 * 30, JSON.stringify(payment));
      logger.info(`Till payment recorded: ${userId} - KES ${amount}`);

      return payment.reference;
    } catch (err) {
      logger.error("Record till payment failed", err);
      return null;
    }
  }

  /**
   * Verify till payment by reference code
   */
  async verifyTillPayment(userId, referenceCode) {
    try {
      const key = `payment:till:${userId}`;
      const payment = await this.redis.get(key);

      if (!payment) return false;

      const p = JSON.parse(payment);
      const isValid =
        p.reference === referenceCode && p.status === "pending";

      if (isValid) {
        p.status = "verified";
        await this.redis.setex(key, 86400 * 30, JSON.stringify(p));
      }

      return isValid;
    } catch {
      return false;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(userId) {
    try {
      const key = `payment:till:${userId}`;
      const payment = await this.redis.get(key);

      if (!payment) return null;

      return JSON.parse(payment);
    } catch {
      return null;
    }
  }

  /**
   * Format payment confirmation
   */
  formatPaymentConfirmation(amount, tier, reference) {
    const tierText = {
      member: "👤 Member Access (Lifetime)",
      vvip_day: "💎 VVIP Daily (24 hours)",
      vvip_week: "💎 VVIP Weekly (7 days)",
      vvip_month: "💎 VVIP Monthly (30 days)",
    };

    return (
      `✅ <b>Payment Sent!</b>\n\n` +
      `Till: ${this.tillNumber}\n` +
      `Amount: KES ${amount}\n` +
      `Account: ${this.accountName}\n` +
      `Tier: ${tierText[tier] || "Standard"}\n` +
      `Reference: <code>${reference}</code>\n\n` +
      `⏳ Processing...\n` +
      `When confirmed, you'll get instant access.\n\n` +
      `💡 Keep your reference code for support`
    );
  }

  /**
   * Get till account summary
   */
  formatAccountSummary() {
    return (
      `📊 <b>BETRIX Till Account</b>\n\n` +
      `Till Number: <code>${this.tillNumber}</code>\n` +
      `Business: ${this.accountName}\n` +
      `Type: M-Pesa Merchant Till\n` +
      `Method: Lipa na M-Pesa\n\n` +
      `<b>What's Included:</b>\n` +
      `✓ Instant payment processing\n` +
      `✓ Automatic verification\n` +
      `✓ Lifetime access (for member)\n` +
      `✓ Mobile money support\n` +
      `✓ No card required\n\n` +
      `<b>How It Works:</b>\n` +
      `1️⃣ Go to M-Pesa menu\n` +
      `2️⃣ Select "Lipa na M-Pesa"\n` +
      `3️⃣ Enter till and amount\n` +
      `4️⃣ Get instant access`
    );
  }
}

export { SafaricomTillService };
