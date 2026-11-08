# NextMove backend

Local application with Claude’s supplied HTML prototype connected to the backend. Run with Node 22.13 or newer:

    npm test
    npm run dev

Open http://127.0.0.1:3001 after starting. The same server serves both frontend and API; no separate proxy needed. If port 3001 is occupied, run `PORT=3002 npm run dev` and open http://127.0.0.1:3002. Listens only on loopback. SQLite persists local demo sessions, goals, approvals and audit. No installation dependencies. This initial implementation uses JavaScript modules and local SQLite to run without external credentials; the proposed TypeScript/Zod/Supabase architecture remains migration work. Do not expose this demo server to the public internet. Sessions are synthetic local demo sessions, not production authentication.

Run `python3 scripts/setup_keys.py` to save provider keys privately in the ignored .env file. npm run dev loads .env automatically. Never put provider keys in frontend variables. NVIDIA calls are optional; without a key the API clearly reports AI unavailable. Nessie sync is explicitly unavailable pending verified mappings; backend/nessie-smoke.mjs provides a read-only connection check. No live integration has been verified.

Implemented: synthetic snapshot, three indicators, 30-day scenarios, conservative intra-day balance ordering, bounded two-call Nemotron plan/selection workflow, deterministic receipt numbers, cookie-scoped demo users, transactional goal contribution reduction and audit, repeat-safe action approval. Runs are synchronous and kept in memory. Goal changes are unscheduled app preferences, not bank transactions or forecast obligations.

Tests cover financial numbers, invalid dates/money, isolation and repeated approvals. Remaining: full typed schemas, production authentication/authorization, real Nessie normalization, richer detector registry, contextual metric explanation, agent evaluations, request/session limits, persistent runs, production deployment. The code is a working foundation, not the completed specification.

See docs/FRONTEND-HANDOFF.md for the implemented contract. The safer demo payment occurs Nov 15, following payday; Nov 14 remains unsafe under conservative outflows-first ordering. This corrects the earlier plan's inconsistent same-day example.

## Imported frontend

Copied NextMove.dc.html and support.js from the supplied prototype; original Downloads files were not edited. The runtime loads pinned React/Babel assets from unpkg and fonts from Google, so first load requires internet. Imported SQLite data was not copied. Added narrow-screen layout adaptation and reused existing demo sessions across reloads. Browser-verified dashboard, rejected immediate payment, accepted Nov 15 alternative, approved app goal change and persistence after reload. Five automated tests pass, including page serving and session reuse.
