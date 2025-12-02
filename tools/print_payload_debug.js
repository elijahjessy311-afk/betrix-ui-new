// tools/print_payload_debug.js
import fs from "fs";
import crypto from "crypto";

const secret = process.argv[2] || process.env.LIPANA_SECRET;
const payloadPath = process.argv[3] || "./payload.json";

if (!secret) {
  console.error("❌ Missing secret. Provide as arg or set LIPANA_SECRET env.");
  process.exit(2);
}

const bodyText = fs.readFileSync(payloadPath, "utf8");
const buf = Buffer.from(bodyText, "utf8");

console.log("=== Payload Debug ===");
console.log("File:", payloadPath);
console.log("Payload length (bytes):", buf.length);
console.log("Raw hex (first 64 bytes):", buf.slice(0, 64).toString("hex"));
console.log("Raw UTF-8 preview (first 300 chars):", buf.toString("utf8").slice(0, 300));

const sigHex = crypto.createHmac("sha256", secret).update(buf).digest("hex");
const sigB64 = crypto.createHmac("sha256", secret).update(buf).digest("base64");

console.log("Computed HMAC (hex):", sigHex);
console.log("Computed HMAC (base64):", sigB64);