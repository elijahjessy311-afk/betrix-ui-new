/**
 * Global Service - Multi-country support
 * Handles localization, currency conversion, payment routing
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("GlobalService");
void logger;

const COUNTRIES = {
  KE: { name: "Kenya", flag: "🇰🇪", language: "sw", currency: "KES", phone: "+254" },
  NG: { name: "Nigeria", flag: "🇳🇬", language: "en", currency: "NGN", phone: "+234" },
  ZA: { name: "South Africa", flag: "🇿🇦", language: "en", currency: "ZAR", phone: "+27" },
  TZ: { name: "Tanzania", flag: "🇹🇿", language: "sw", currency: "TZS", phone: "+255" },
  UG: { name: "Uganda", flag: "🇺🇬", language: "en", currency: "UGX", phone: "+256" },
  GH: { name: "Ghana", flag: "🇬🇭", language: "en", currency: "GHS", phone: "+233" },
  ZM: { name: "Zambia", flag: "🇿🇲", language: "en", currency: "ZMW", phone: "+260" },
  BW: { name: "Botswana", flag: "🇧🇼", language: "en", currency: "BWP", phone: "+267" },
  US: { name: "USA", flag: "🇺🇸", language: "en", currency: "USD", phone: "+1" },
  GB: { name: "UK", flag: "🇬🇧", language: "en", currency: "GBP", phone: "+44" },
  FR: { name: "France", flag: "🇫🇷", language: "fr", currency: "EUR", phone: "+33" },
  CA: { name: "Canada", flag: "🇨🇦", language: "en", currency: "CAD", phone: "+1" },
  AU: { name: "Australia", flag: "🇦🇺", language: "en", currency: "AUD", phone: "+61" },
};

const PAYMENT_METHODS = {
  KE: ["till", "mpesa_stk", "paypal", "binance"],
  NG: ["flutterwave", "paystack", "paypal", "binance"],
  ZA: ["eft", "paypal", "stripe", "binance"],
  TZ: ["mpesa_stk", "paypal", "binance"],
  UG: ["mpesa_stk", "paypal", "binance"],
  GH: ["mtn", "paypal", "binance"],
  ZM: ["paypal", "binance"],
  BW: ["paypal", "binance"],
  US: ["paypal", "stripe", "apple_pay", "google_pay", "binance"],
  GB: ["paypal", "stripe", "apple_pay", "google_pay", "binance"],
  FR: ["paypal", "stripe", "apple_pay", "binance"],
  CA: ["paypal", "stripe", "apple_pay", "google_pay", "binance"],
  AU: ["paypal", "stripe", "binance"],
};

const EXCHANGE_RATES = {
  // To USD (approximate, should be fetched from API in production)
  KES: 0.0067,
  NGN: 0.00067,
  ZAR: 0.056,
  TZS: 0.00039,
  UGX: 0.00026,
  GHS: 0.065,
  ZMW: 0.044,
  BWP: 0.072,
  USD: 1.0,
  GBP: 1.27,
  EUR: 1.1,
  CAD: 0.73,
  AUD: 0.65,
};

const PRICING = {
  member: { USD: 1, factor: 1.0 },
  vvip_day: { USD: 2, factor: 1.0 },
  vvip_week: { USD: 8, factor: 1.0 },
  vvip_month: { USD: 20, factor: 1.0 },
};

class GlobalService {
  /**
   * Get country info
   */
  static getCountry(countryCode) {
    return COUNTRIES[countryCode.toUpperCase()] || null;
  }

  /**
   * Get payment methods for country
   */
  static getPaymentMethods(countryCode) {
    return PAYMENT_METHODS[countryCode.toUpperCase()] || ["paypal", "binance"];
  }

  /**
   * Convert USD to local currency
   */
  static convertUSD(usdAmount, targetCurrency) {
    const rate = EXCHANGE_RATES[targetCurrency];
    if (!rate) return usdAmount;

    const amount = usdAmount / rate;

    // Round to clean numbers based on currency
    if (targetCurrency === "KES") return Math.round(amount / 50) * 50;
    if (targetCurrency === "NGN") return Math.round(amount / 1000) * 1000;
    if (targetCurrency === "ZAR") return Math.round(amount / 10) * 10;
    if (targetCurrency === "TZS") return Math.round(amount / 500) * 500;

    return Math.round(amount);
  }

  /**
   * Get local pricing
   */
  static getLocalPricing(tier, countryCode) {
    const country = this.getCountry(countryCode);
    if (!country) return null;

    const baseUSD = PRICING[tier]?.USD || 0;
    const factor = PRICING[tier]?.factor || 1.0;

    const localAmount = this.convertUSD(baseUSD * factor, country.currency);

    return {
      amount: localAmount,
      currency: country.currency,
      displayUSD: baseUSD,
      displayText: `${country.currency} ${localAmount} (≈ USD ${baseUSD})`,
    };
  }

  /**
   * Validate phone for country
   */
  static validatePhone(phone, countryCode) {
    const patterns = {
      KE: /^(?:\+254|0)(?:7|1)[0-9]{8}$/,
      NG: /^(?:\+234|0)[789][01]\d{8}$/,
      ZA: /^(?:\+27|0)[1-9]\d{8,9}$/,
      TZ: /^(?:\+255|0)[67]\d{8}$/,
      UG: /^(?:\+256|0)[7]\d{8}$/,
      GH: /^(?:\+233|0)[2-9]\d{8}$/,
      US: /^(?:\+1)?[2-9]\d{2}[2-9](?!11)\d{6}$/,
      GB: /^(?:\+44|0)[1-9]\d{9,10}$/,
    };

    const pattern = patterns[countryCode.toUpperCase()];
    return pattern ? pattern.test(phone) : true;
  }

  /**
   * Format phone for country
   */
  static formatPhone(phone, countryCode) {
    const country = this.getCountry(countryCode);
    if (!country) return phone;

    // Remove all non-digits except +
    let cleaned = phone.replace(/[^\d+]/g, "");

    // Remove leading +
    if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);

    // Remove leading 0
    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);

    return `${country.phone}${cleaned}`;
  }

  /**
   * Build country keyboard
   */
  static buildCountryKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🇰🇪 Kenya", callback_data: "country:KE" },
          { text: "🇳🇬 Nigeria", callback_data: "country:NG" },
        ],
        [
          { text: "🇿🇦 S.Africa", callback_data: "country:ZA" },
          { text: "🇹🇿 Tanzania", callback_data: "country:TZ" },
        ],
        [
          { text: "🇺🇸 USA", callback_data: "country:US" },
          { text: "🇬🇧 UK", callback_data: "country:GB" },
        ],
        [{ text: "🌍 Other...", callback_data: "country:other" }],
      ],
    };
  }

  /**
   * Build language keyboard for country
   */
  static buildLanguageKeyboard(_countryCode) {
    const _languages = {
      en: { flag: "🇬🇧", label: "English" },
      sw: { flag: "🇰🇪", label: "Swahili" },
      fr: { flag: "🇫🇷", label: "Français" },
    };

    void _languages;
    return {
      inline_keyboard: [
        [
          { text: "🇬🇧 English", callback_data: "lang:en" },
          { text: "🇰🇪 Swahili", callback_data: "lang:sw" },
        ],
        [
          { text: "🇫🇷 Français", callback_data: "lang:fr" },
        ],
      ],
    };
  }

  /**
   * Build payment methods keyboard
   */
  static buildPaymentKeyboard(countryCode) {
    const methods = this.getPaymentMethods(countryCode);
    const buttons = [];

    const labels = {
      till: "📱 Safaricom Till",
      mpesa_stk: "💸 M-Pesa STK",
      paypal: "🏦 PayPal",
      binance: "₿ Binance",
      flutterwave: "💳 Flutterwave",
      paystack: "💳 Paystack",
      eft: "🏦 EFT Transfer",
      stripe: "💳 Stripe",
      mtn: "📱 MTN Money",
      apple_pay: "🍎 Apple Pay",
      google_pay: "🔵 Google Pay",
    };

    for (let i = 0; i < methods.length; i += 2) {
      const row = [];
      row.push({
        text: labels[methods[i]] || methods[i],
        callback_data: `payment:${methods[i]}`,
      });
      if (methods[i + 1]) {
        row.push({
          text: labels[methods[i + 1]] || methods[i + 1],
          callback_data: `payment:${methods[i + 1]}`,
        });
      }
      buttons.push(row);
    }

    return { inline_keyboard: buttons };
  }
}

export { GlobalService };
