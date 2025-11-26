Hi @brunomogeni,

Can you please run the payment harness locally and verify the payment flows? GitHub Actions is currently blocked by a billing issue so I couldn't run the harness from CI. Steps to run (PowerShell):

```powershell
# install deps
npm ci

# set required env vars (replace values)
$env:REDIS_URL = "redis://..."
$env:TELEGRAM_TOKEN = "REPLACE_WITH_VALUE"
$env:ADMIN_TELEGRAM_ID = "259313404"
$env:PAYPAL_CLIENT_ID = "REPLACE_WITH_VALUE"
$env:PAYPAL_CLIENT_SECRET = "REPLACE_WITH_VALUE"
$env:PAYPAL_MODE = "sandbox"
$env:MPESA_TILL = "606215"
$env:TEST_METHOD = "PAYPAL" # or SAFARICOM_TILL, MPESA, BINANCE
$env:TEST_TIER = "PLUS"
$env:TEST_USER_ID = "9999"

# run harness
node scripts/test-payment-harness.js
```

Checklist:
- Verify `payment:order:{orderId}` and `payment:by_provider_ref:{provider}:{ref}` are created in Redis.
- Simulate webhook (if needed) and confirm user receives Telegram notification and subscription active.

Please reply with the harness output or any errors and I will follow up immediately. Thanks!
