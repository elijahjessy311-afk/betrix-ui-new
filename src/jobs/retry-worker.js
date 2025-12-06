/*
 * src/jobs/retry-worker.js
 * Small retry worker: pops messages from redis list "betrix:retry" and attempts HTTP delivery.
 * Run this via node src/jobs/retry-worker.js or as a separate process/PM2 job.
 */
const { createClient } = require("redis");
const fetch = globalThis.fetch || require("node-fetch");
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error("retry-worker: REDIS_URL not set; exiting");
  process.exit(1);
}
(async () => {
  const client = createClient({ url: redisUrl });
  client.on("error", (e) => console.error("redis err", e && e.message));
  await client.connect();
  console.log("retry-worker started");
  // loop intentionally runs indefinitely to process retry queue
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const item = await client.brPop("betrix:retry", 5); // timeout 5s
      if (!item) continue;
      const payload = JSON.parse(item.element);
      // attempt deliver (example: Telegram sendMessage)
      const resp = await fetch(payload.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body)
      });
      const data = await resp.json();
      if (!data.ok) {
        console.error("retry-delivery-failed", JSON.stringify({ body: payload.body, response: data }));
        // requeue with backoff (simple)
        payload.attempts = (payload.attempts || 0) + 1;
        if (payload.attempts < 5) {
          await client.lPush("betrix:retry", JSON.stringify(payload));
        } else {
          console.error("dead-letter", JSON.stringify(payload));
        }
      } else {
        console.log("retry-delivered", payload.body?.chat_id || null);
      }
    } catch (err) {
      console.error("retry-loop-err", err && (err.stack || err.message));
      await new Promise(r => setTimeout(r, 2000));
    }
  }
})();
