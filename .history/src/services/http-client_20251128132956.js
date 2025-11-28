/**
 * HTTP client with retry, timeout, and error handling
 */

import fetch from "node-fetch";
import { Logger } from "../utils/logger.js";
import { APIError, TimeoutError } from "../utils/errors.js";

const logger = new Logger("HttpClient");

class HttpClient {
  /**
   * Fetch with retries and timeout
   */
  static async fetch(url, options = {}, label = "request", retries = 2, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const text = await response.text();
      if (!response.ok) {
        throw new APIError(`HTTP ${response.status} ${response.statusText} ${text}`, response.status);
      }

      // Handle empty responses
      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new TimeoutError(`${label} timed out after ${timeoutMs}ms`);
      }

      // If this is an APIError with a non-retryable status, propagate immediately
      const status = err && (err.statusCode || err.status || 0);
      if (status && [401, 403, 404].includes(Number(status))) {
        logger.warn(`Non-retryable HTTP ${status} for ${label}; not retrying`);
        throw err;
      }

      // If we have retries left, attempt retry with a modest backoff. Treat 429 specially with longer backoff.
      if (retries > 0) {
        const waitMs = (status === 429) ? 2000 : 600;
        logger.warn(`Retry ${label}: ${err.message} (${retries} retries left), waiting ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        return HttpClient.fetch(url, options, label, retries - 1, timeoutMs);
      }

      throw new APIError(`${label} failed: ${err.message}`);
    }
  }
}

export { HttpClient };
