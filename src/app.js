import express from "express";
import bodyParser from "body-parser";
import Redis from "ioredis";

const app = express();

// Connect to Redis using environment variable
const redis = new Redis(process.env.REDIS_URL);

// Middleware
app.use(bodyParser.json());

// Disable caching (important for iframe previews or dynamic responses)
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// --- Health check routes ---
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// --- Telegram webhook route ---
app.post("/webhook", async (req, res) => {
  const update = req.body;

  try {
    // Push into Redis queue for worker consumption
    await redis.rpush("telegram-jobs", JSON.stringify({ payload: update }));
    console.log("Telegram update received:", update);
    res.sendStatus(200);
  } catch (error) {
    console.error("Telegram webhook error:", error);
    res.sendStatus(500);
  }
});

// --- PayPal webhook routes ---
app.get("/paypal/success", async (req, res) => {
  const { token } = req.query;

  try {
    const pendingData = await redis.get(`payment:pending:${token}`);

    if (!pendingData) {
      return res.send("Payment session expired. Please try again.");
    }

    await redis.rpush(
      "payment-jobs",
      JSON.stringify({
        type: "paypal_success",
        orderId: token,
        pendingData: JSON.parse(pendingData),
        timestamp: Date.now(),
      })
    );

    res.send(`
      <html>
        <body>
          <h1>✅ Payment Successful!</h1>
          <p>Your BETRIX subscription is being activated...</p>
          <p>Return to Telegram to continue.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("PayPal success handler error:", error);
    res.status(500).send("Error processing payment");
  }
});

app.get("/paypal/cancel", (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>❌ Payment Cancelled</h1>
        <p>Your subscription was not activated.</p>
        <p>Return to Telegram and try again with /subscribe</p>
      </body>
    </html>
  `);
});

app.post("/paypal/webhook", async (req, res) => {
  const event = req.body;

  try {
    await redis.rpush(
      "payment-jobs",
      JSON.stringify({
        type: "paypal_webhook",
        event: event.event_type,
        resource: event.resource,
        timestamp: Date.now(),
      })
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("PayPal webhook error:", error);
    res.sendStatus(500);
  }
});

// --- Server start ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
