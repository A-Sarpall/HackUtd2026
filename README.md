# Koin

**A second opinion before every money move.**

Most money apps tell you what you already spent. Koin tells you whether your *next* move is a good idea and why. It shows your checking balance over the next 30 days using real bank data, and lets you ask Kip, your money sidekick, anything about your money. Before any change to your plan, a small team of AI agents reviews it and gives a verdict.

Built for HackUTD 2026 with the **Capital One Nessie** sandbox API and **NVIDIA Nemotron**.

## What it does

- **Your money as a stream.** A day-by-day chart of your checking balance for the next 30 days, built from Nessie accounts, balances and bills, plus the pay, bills, habits and goals you enter. It marks the lowest point ahead and your safety cushion, then zooms out to a year and the long run.
- **Kip, a real chatbot.** Ask anything in your own words, for example "What is a credit card and how much do I owe?" or "How low will my checking get?". Kip answers from your own numbers, explains terms, and can turn "I want to save $1,000 for a trip by June" into a goal you can review.
- **Hover to learn.** Hover over terms like *checking* or *savings* for a plain explanation, then use **Follow up with Kip** to keep asking.
- **Agent reviews before every decision.**
  - Changes the agents review: a one-time extra card payment, a monthly change to any goal, the emergency fund, a card or a loan (type `+30` or `-40`), and new goals.
  - Each review gives a verdict: **Looks good**, **OK, with caution** or **Not recommended**. It explains why and, when possible, suggests a safer amount or date.
- **You approve, never the AI.** Nothing changes until you click Approve. The server checks again that your data hasn't changed, the proposal hasn't expired, and you're still above your cushion and within budget. Then it saves the change with an audit entry.
- **Decision receipts.** Every approved decision keeps a record of its data, the checks it passed and the agent steps that produced it.

Koin never moves money. Nessie data is read-only, and approved changes only update your plan inside Koin.

## How the agents work

Each request goes through a small, bounded graph. One hosted Nemotron model plays the AI roles, and code does all the math.

| Step | Role | Type | Job |
|------|------|------|-----|
| 1 | Coordinator | AI | Works out what you're asking and picks one allowlisted tool (answer, explain, compare a payment, propose a goal, ask for clarification) |
| 2 | Financial engine | Code | Calculates the facts from your snapshot in integer cents |
| 3 | Verifier | Code | Checks the safety cushion and the monthly budget, and blocks anything that fails |
| 4 | Strategist | AI | If the request fails a check, picks the safer alternative that best keeps your intent |
| 5 | Coach | AI | Writes the reply and the verdict |

**The AI can't invent numbers.**
- The Coach must write `{placeholders}`, such as `{lowest_balance}`, instead of figures. The server fills them in with verified values.
- Any digit, currency sign, percent sign or spelled-out number outside a placeholder is rejected, and the Coach gets one chance to correct it.
- Limits are enforced in code: at most 4 model calls, 6 tool calls and a 45-second deadline per run.
- Missing data, such as an unknown APR or take-home pay, stays unknown instead of becoming zero, and the reply says so.

## Getting started

Requires **Node 22.13 or newer**. There are no dependencies to install.

1. **Add your API keys.** Run this script. It prompts for the keys privately and writes them to `.env`, which Git ignores:
   ```bash
   python3 scripts/setup_keys.py
   ```
   Or copy `.env.example` to `.env` and fill in `NVIDIA_API_KEY` and `NESSIE_API_KEY`.

2. **Start the server:**
   ```bash
   npm run dev
   ```
   It prints its local URL (port `3001` by default, or `PORT` from `.env`). The same server serves the frontend and the API.

3. **Open the URL in your browser.** Koin loads the first Nessie sandbox customer automatically.
   - With no Nessie customers, it loads a labeled demo customer.
   - Add take-home pay, bills, APRs and goals in **Data & goals**.

Without an NVIDIA key, the calculations still work, and the app says clearly that AI answers are unavailable.

## Project layout

```
backend/
  server.mjs        HTTP server, sessions, SQLite storage, API routes, approvals and audit
  finance.mjs       Money math in integer cents: forecast, scenarios, goal progress, budget
  intelligence.mjs  Profile validation, plan flows, verified facts for answers and reviews
  agents.mjs        Bounded agent graph (Coordinator, Strategist, Coach) and output checks
  nessie.mjs        Read-only Nessie sandbox import
frontend/
  index.html        Koin (main app)
  koin-model.js     Koin view model: stream, levers, Kip chat, reviews, approvals
  support.js        Template runtime
  classic.html      Earlier interface, kept at /classic
tests/              node:test suites for finance, agents, actions, API and security
scripts/            Key setup, agent evaluation, live demo check
docs/               Workflow details, deployment and status
```

### Main API routes (`/api/v1`)

| Route | Purpose |
|-------|---------|
| `GET /snapshot` | Current balances, forecast, findings and budget |
| `GET /customers`, `POST /sync` | List Nessie customers and load one, or the demo |
| `PUT /profile` | Save the plan (pay, bills, habits, debts, goals) in cents |
| `POST /runs` | Ask Kip: runs the agent workflow |
| `POST /reviews` | Agent review of a payment, goal or debt change |
| `POST /actions`, `POST /actions/:id/approve` | Propose, then approve, a reviewed change |
| `GET /receipts` | Decision receipts |

## Checks

```bash
npm test         # unit and API tests
npm run eval     # agent evaluation cases
```

For a live end-to-end check against a running server, with sandbox keys configured:

```bash
NEXTMOVE_URL=http://127.0.0.1:3001 node scripts/verify_demo.mjs
```

## Deployment

[docs/DEPLOY.md](docs/DEPLOY.md) covers the Docker image, the settings it needs (`PUBLIC_ORIGIN` and a persistent `/data` volume), security controls and rate limits.

## Limits

- This is a hackathon demo. Sessions are scoped to a cookie, and there is no production login.
- Nessie sandbox data has no take-home pay or card APR. Until you add them, budget and payoff checks are marked unknown.
- Koin's 30-day stream matches the server forecast to the cent; agents only run while the two agree. Projections beyond 30 days are computed in the browser.
- Agent runs are rate limited per session, and the same limit covers Kip and reviews.
- The frontend loads React, Babel and Google Fonts from the internet on first load.

More detail: [implemented workflow](docs/IMPLEMENTED-WORKFLOW.md) · [status](docs/status.md)
