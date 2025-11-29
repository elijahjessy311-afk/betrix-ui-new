# Changelog (prefer-sportmonks-20251129)

## 2025-11-29 — prefer-sportmonks-20251129

- Prefer SportMonks as the primary football live provider (fallback: StatPal).
- Added `src/services/sportmonks-service.js` (axios wrapper) and normalization improvements.
- Restored and wired `/live` handler and match-details callback flow for Telegram (v2 handler).
- Added per-service TLS option for SportMonks (`SPORTSMONKS_INSECURE`) for local dev only.
- Added PowerShell helpers and Node dev tools for diagnosing TLS interception and a local relay.
- Improved Redis handling to prefer `REDIS_URL` and avoid unhandled `NOAUTH` errors.
- Removed large `.history` snapshots from branch and added `.history/` to `.gitignore`.
- Moved developer-only helper scripts into `docs/dev-scripts/` (copies created).
- README: documentation for TLS interception, Redis troubleshooting, and pointer to `docs/dev-scripts/`.


## Notes
- Do NOT enable `SPORTSMONKS_INSECURE` in production. Install proxy CA or allowlist hosts instead.
- After review, merge `prefer-sportmonks-20251129` to `main` and deploy the worker. Validate `/live` flows.
