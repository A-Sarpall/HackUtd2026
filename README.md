# NextMove Personal

Local personal finance app with Nessie sandbox data, NVIDIA Nemotron Sidekick, deterministic financial calculations, goal comparisons, and approved app changes.

## Start

Requires Node 22.13 or newer. No dependency installation is needed.

```sh
python3 scripts/setup_keys.py
npm run dev
```

The server prints its local URL. The saved .env file is loaded automatically; it is excluded from Git along with SQLite files. The frontend and API share the same server.

## Use

Open Data & goals to choose a Nessie sandbox customer and enter income, bills and goals; then compare a payment and ask Sidekick. Decision receipts include public role activity, verified scenarios, evidence and checks. A receipt can be linked to an explicitly approved contribution change.

Implemented workflow, five steps: Coordinator (AI) → Financial engine (code) → Verifier (code) → Strategist (AI) → Coach (AI). In Sidekick, "How it works" explains the steps, and "How this answer was made" shows the recorded steps behind each answer. One configured hosted Nemotron model serves all roles. No model training is required. Without a key, the app clearly reports AI unavailable and deterministic calculations remain available.

Nessie imports are read-only. The app never moves bank funds. Goal approval changes the first goal's ongoing contribution setting and records an audit entry.

## Checks

```sh
npm test
```

For an authorized live sandbox end-to-end check against a running server:
```sh
NEXTMOVE_URL=http://127.0.0.1:3003 node scripts/verify_demo.mjs
```

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md) for the Docker image, required settings (`PUBLIC_ORIGIN`, persistent `/data`), security controls and known limits.

Read [the implemented workflow](docs/IMPLEMENTED-WORKFLOW.md) for formulas, assumptions, supported routes and practical limits.

## Scope

The current stack is JavaScript modules, a Node server, SQLite, and the supplied Claude frontend/runtime. The original TypeScript/Next.js/Supabase architecture remains a future migration. This is a local demo using cookie-scoped sessions, not production user authentication. The frontend runtime uses external React/Babel assets and Google Fonts, so initial loading needs internet.

Blank income, expense, loan, or goal inputs remain unknown. The forecast includes known dated events, not automatically inferred future income. Goal comparisons and loan results are explicitly assumption-based. No automatic financial categorization or production security certification is claimed.
