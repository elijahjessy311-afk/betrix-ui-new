/**
 * Transaction Service - Complete payment history & analytics
 */

import { Logger } from "../utils/logger.js";
import { db } from "../database/db.js";
import { payments, users } from "../database/schema.js";
import { eq, desc } from "drizzle-orm";

const logger = new Logger("TransactionService");

class TransactionService {
  /**
   * Get user transaction history
   */
  async getTransactionHistory(userId, limit = 20) {
    try {
      const txns = await db.query.payments.findMany({
        where: eq(payments.userId, userId),
        orderBy: desc(payments.createdAt),
        limit,
      });

      return txns.map((t) => ({
        id: t.id,
        amount: `${t.currency} ${t.amount}`,
        method: t.method,
        tier: t.tier,
        status: t.status,
        date: t.createdAt?.toLocaleDateString(),
        reference: t.reference,
      }));
    } catch (err) {
      logger.error("Get history failed", err);
      return [];
    }
  }

  /**
   * Format transaction receipt
   */
  async formatReceipt(paymentId) {
    try {
      const payment = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId),
      });

      if (!payment) return null;

      const user = await db.query.users.findFirst({
        where: eq(users.id, payment.userId),
      });

      return `📄 <b>RECEIPT</b>\n\n` +
        `Name: ${user?.name}\n` +
        `Amount: ${payment.currency} ${payment.amount}\n` +
        `Method: ${payment.method}\n` +
        `Tier: ${payment.tier}\n` +
        `Status: ${payment.status}\n` +
        `Date: ${payment.createdAt?.toLocaleDateString()}\n` +
        `Reference: ${payment.reference}\n` +
        `Transaction ID: ${payment.transactionId || "—"}`;
    } catch (err) {
      logger.error("Format receipt failed", err);
      return null;
    }
  }

  /**
   * Get user spending analytics
   */
  async getSpendingAnalytics(userId) {
    try {
      const txns = await db.query.payments.findMany({
        where: eq(payments.userId, userId),
      });

      const total = txns.reduce((sum, t) => sum + Number(t.amount), 0);
      const byTier = {};

      txns.forEach((t) => {
        byTier[t.tier] = (byTier[t.tier] || 0) + Number(t.amount);
      });

      const byMethod = {};
      txns.forEach((t) => {
        byMethod[t.method] = (byMethod[t.method] || 0) + 1;
      });

      return {
        totalSpent: total,
        transactionCount: txns.length,
        byTier,
        byMethod,
        lastTransaction: txns[0],
      };
    } catch (err) {
      logger.error("Analytics failed", err);
      return null;
    }
  }

  /**
   * Record transaction
   */
  async recordTransaction(userId, amount, method, tier, reference = null) {
    try {
      const payment = await db.insert(payments).values({
        userId,
        amount,
        method,
        tier,
        reference: reference || `TXN-${userId}-${Date.now()}`,
        status: "pending",
      });

      return payment;
    } catch (err) {
      logger.error("Record transaction failed", err);
      return null;
    }
  }
}

export { TransactionService };
