# Deploying NextMove

NextMove is a public demo that uses made-up and Nessie sandbox data. Visitors get anonymous sessions that expire after 7 days. The app never connects to real bank accounts and never moves money. Do not add real financial data or real login without a separate security review.

## What you need

- **A domain.** A domain only points visitors to a server; it does not run the app.
- **A host that runs a Docker container** with a persistent disk mounted at `/data`. Any container host or small VPS works. Without a persistent disk, sessions and receipts are lost on every restart.
- **HTTPS** at the domain. Most container hosts provide it automatically. On a VPS, put a TLS reverse proxy (for example Caddy or nginx) in front of the app.

## Steps

1. Build and run the image from the repository root: `docker build -t nextmove .`
2. Mount a persistent volume at `/data`.
3. Set these environment variables as host secrets, never in the image or Git:

| Variable | Value |
|---|---|
| `PUBLIC_ORIGIN` | `https://your-domain` (exact, no trailing slash). **Required.** Turns on Secure cookies, HSTS, and Host/Origin checks. |
| `TRUST_PROXY` | `1` when the app runs behind the host's load balancer or your reverse proxy. Leave unset if visitors connect directly. |
| `NVIDIA_API_KEY` | Optional. Without it, Sidekick reports "AI unavailable" and the calculator still works. |
| `NVIDIA_MODEL` | Optional model override. |
| `NESSIE_API_KEY`, `NESSIE_BASE_URL` | Optional. Without a key, sandbox customers can't be loaded and the demo data is used. |
| `AI_DAILY_RUN_LIMIT` | Daily cap on Sidekick runs across all visitors (default 500). Set it to fit your NVIDIA quota. |

The image already sets `HOST=0.0.0.0`, `PORT=8080` and `DATABASE_PATH=/data/nextmove.sqlite`.

4. Point the domain's DNS record at the host, following the host's instructions, and wait for HTTPS to become active.
5. Check: `https://your-domain/health` returns `{"ok":true}`. The page loads, the badge reads DEMO or NESSIE SANDBOX, and Sidekick answers.

## What the server enforces

- **Security headers:** Content-Security-Policy, X-Frame-Options DENY, nosniff, no-referrer, same-origin COOP/CORP, a restrictive Permissions-Policy, and HSTS over HTTPS.
- **Sessions:** random 256-bit `__Host-` cookie that is HttpOnly, Secure and SameSite=Strict, with a 7-day expiry. Expired sessions and all their data are deleted automatically.
- **Request checks:** the Host must match `PUBLIC_ORIGIN`. Cross-site writes are rejected. Writes must be JSON. Bodies are limited to 16 KB. Request timeouts are set.
- **Rate limits (per process, in memory):** 300 API requests per IP per 5 minutes, 20 new sessions per IP per hour, 20 Sidekick runs and 30 sandbox loads per session per hour, plus the daily AI cap. When a limit is hit, the server returns 429 with Retry-After.
- **Storage caps:** at most 50 receipts per session.
- **Logs:** request IDs and error codes only, never request bodies or financial data.
- **Shutdown:** stops cleanly on SIGTERM.
- **AI:** cannot approve changes. Approval is checked by the server for ownership, expiry, proposal hash and data version.

## Known limits

- **Third-party scripts:** the page loads React and Babel from unpkg.com (pinned with integrity hashes) and fonts from Google. The supplied runtime compiles templates in the browser, so the CSP must allow `unsafe-eval`. Removing this requires a build step that precompiles the frontend.
- **Single instance:** rate limits reset on restart and aren't shared between instances. Run one instance with SQLite.
- **No edge protection:** large-scale attacks need protection in front of the app, such as the host's DDoS protection or a CDN or firewall.
- **Not tested here:** the Docker image has not been built or run in this environment. Build it and run the health check before pointing the domain at it.
- **Other gaps:** no real user accounts, no strict TypeScript, and AI wording is not checked for meaning (numbers and choices are).
