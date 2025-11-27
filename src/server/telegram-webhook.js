const { createClient } = require("redis");

async function getRedis() {
  if (global.__REDIS_CLIENT && global.__REDIS_CLIENT.isOpen) return global.__REDIS_CLIENT;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  const client = createClient({ url, password: process.env.REDIS_PASSWORD || undefined, socket: { reconnectStrategy: () => 1000 } });
  client.on("error", (e) => console.error("REDIS_ERR", e && e.stack ? e.stack : String(e)));
  await client.connect();
  global.__REDIS_CLIENT = client;
  return client;
}

module.exports = async function telegramWebhookHandler(req, res) {
  try {
    const body = req.body || {};
    const client = await getRedis();

    // Enqueue the raw Telegram update onto the canonical list the worker consumes
    // Worker (src/worker-db.js) expects JSON updates on `telegram:updates` and will
    // JSON.parse the popped value directly into the update object.
    await client.rPush("telegram:updates", JSON.stringify(body));

    // Keep additional audit/debug queues for observability
    try {
      const auditJob = JSON.stringify({ jobId: `wh-${Date.now()}`, payload: body });
      await client.rPush("telegram:webhook:queue", auditJob);
      await client.rPush("webhooks:incoming", auditJob);
      console.log("SHIM_ENQUEUED", { jobId: auditJob.slice(0,64) });
    } catch (e) {
      console.warn("SHIM_AUDIT_QUEUE_WARN", e && e.message ? e.message : e);
    }

    return res.status(200).json({ ok:true, enqueued:true });
  } catch (err) {
    console.error("SHIM_ENQUEUE_ERR", err && err.stack ? err.stack : String(err));
    return res.status(500).json({ ok:false, error:"enqueue_failed" });
  }
};
