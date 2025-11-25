import { Logger } from '../utils/logger.js';
const logger = new Logger('AdminHandler');

/**
 * Return mapping-miss counts for recent days
 */
export async function getMappingMisses(redis, days = 7) {
  const results = {};
  try {
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const key = `monitor:payment:mapping_misses:${d}`;
      const v = await redis.get(key).catch(() => null);
      results[d] = Number(v || 0);
    }
  } catch (e) {
    logger.warn('getMappingMisses failed', e?.message || String(e));
  }
  return results;
}

/**
 * Safe-scan a bounded number of payment orders and repair missing mappings.
 * options: { scanLimit, days }
 */
export async function safeScanAndRepair(redis, options = {}) {
  const scanLimit = Number(options.scanLimit || 2000);
  const lookbackDays = Number(options.days || 7);
  const repaired = [];
  let cursor = '0';
  let processed = 0;
  try {
    do {
      const reply = await redis.scan(cursor, 'MATCH', 'payment:order:*', 'COUNT', 1000);
      cursor = reply[0];
      const keys = reply[1] || [];
      for (const k of keys) {
        if (processed >= scanLimit) break;
        processed++;
        try {
          const raw = await redis.get(k);
          if (!raw) continue;
          const order = JSON.parse(raw);
          const created = new Date(order.createdAt || Date.now()).getTime();
          if (Date.now() - created > lookbackDays * 24 * 60 * 60 * 1000) continue;

          const orderId = k.split(':').pop();
          // providerRef in metadata or order.providerRef
          const providerRef = (order.metadata && order.metadata.providerRef) || order.providerRef || null;
          const provider = (order.paymentMethod || order.method || order.provider || '').toUpperCase() || null;
          if (providerRef && provider) {
            const mapKey = `payment:by_provider_ref:${provider}:${providerRef}`;
            const exists = await redis.get(mapKey);
            if (!exists) {
              await redis.set(mapKey, orderId);
              repaired.push({ orderId, provider, providerRef });
            }
          }

          // phone mapping
          const phone = order.phone || order.phoneNumber || (order.metadata && order.metadata.phone) || null;
          if (phone) {
            const phoneKey = `payment:by_phone:${String(phone).replace(/\s|\+|-/g, '')}`;
            const existsP = await redis.get(phoneKey);
            if (!existsP) {
              await redis.set(phoneKey, orderId);
              repaired.push({ orderId, phone });
            }
          }
        } catch (e) { /* continue */ }
      }
    } while (cursor !== '0' && processed < scanLimit);
  } catch (e) {
    logger.error('safeScanAndRepair failed', e?.message || String(e));
  }
  return { processed, repaired };
}

export default { getMappingMisses, safeScanAndRepair };
