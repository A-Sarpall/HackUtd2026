# NextMove — project context and development handoff

Prepared November 7, 2026, America/Chicago. This describes observed implementation and remaining work, not a declaration that the original full specification is finished.

## Copy-paste handoff prompt

Continue developing NextMove Personal in the existing local checkout below. Read this document, CLAUDE.md, docs/IMPLEMENTED-WORKFLOW.md, and the actual code before editing. Preserve the uncommitted six-priority expansion. Do not revert to the earlier two-call AI implementation or overwrite the Claude Sidekick design with the older prototype.

The immediate task is to finish the six-priority expansion already built locally: inspect the remaining limitations listed here, verify the updated UI against the current backend, and prepare a precise handoff. Eleven automated tests and an authorized live Nessie/Nemotron end-to-end check passed. The app was then restarted at the usual port 3002; final browser verification and committing/pushing this expansion were interrupted. Do not claim that the expansion is already on GitHub. Check the worktree and running processes before restarting anything.

Keep financial arithmetic and permission checks deterministic. Use one pretrained hosted Nemotron model with Coordinator, Strategist, and Coach prompts. Do not train separate models or create a swarm. Maintain explicit customer selection, unknown-data handling, per-session snapshots, saved receipts, and user-only approval. Do not broaden this into real payments or production bank connectivity. Communicate actual accomplishments and remaining gaps plainly.

## Locations and repository state

- Working app: `/Users/frootyloops44/.codex/.chatgpt-projects/g-p-6aef7a6a76a8819197f65e646ade53bc/nextmove`
- GitHub: `https://github.com/A-Sarpall/HackUtd2026` — private, branch `main`.
- Last committed version at handoff: `f6d05c4` — Add AI Sidekick experience. Prior initial commit: `5197b86`.
- The six-priority expansion is **uncommitted local work**, including backend, frontend, tests and docs.
- Planning packet: `../NextMove-build-packet.zip`; unpacked docs are in `../nextmove-plan/`. Copies named `nextmove-plan 2` and `nextmove-plan 3` also exist. The plan is design intent; current code is implementation truth.
- Original detailed brief: `/Users/frootyloops44/.codex/attachments/ae7f1aa5-41e6-4586-a462-f2c26b94dd37/Pasted text.txt`.
- Updated Claude UI reference: `/Users/frootyloops44/Downloads/NextMove frontend prototype (1)/NextMove v2.dc.html`.
- Earlier UI reference: `/Users/frootyloops44/Downloads/NextMove frontend prototype/`.
- Files under the parent project's `sources/` are synced, read-only references. Do not modify them.

## Product vision and refinements

NextMove helps people without financial expertise understand their money, anticipate problems, compare decisions across goals, and take an explicitly approved next step. The experience should feel like a helpful finance team: understandable explanations backed by traceable calculations.

The original brief was broad: complete financial overview, historical analytics, dynamic calculators, multiple goals, contextual Sidekick, AI-controlled charts, continuous detection, specialist agents, and safe execution. We narrowed the hackathon work to NextMove Personal and a reliable three-minute demonstration. Business is a future offering.

User priorities: useful, accurate, safe, informative, easy to understand, and distinct from a generic chatbot. The user wants Claude to supply UI design/frontend mockups; integrate those designs with the working backend. The current UI is the second Claude prototype, with a single-page financial story, glossary popovers and a floating Sidekick drawer.

The NVIDIA mentor raised communication/training complexity with many agents. Refinement: roles are separate prompt configurations of one hosted pretrained Nemotron model. Host code passes structured results between roles. Deterministic services do financial calculations, detections and verification. No per-role training, GPU hosting or peer-to-peer agent conversation is needed.

The original six named responsibilities were consolidated: Coordinator routes, Strategist compares, Coach explains; data normalization, Sentinel rules, verification and action execution are code services. Add model stages only when useful. A model selecting a tool does not mean it can approve an action.

The sponsor objectives described in the user's brief are PNC financial health/coaching/forecasts, NVIDIA meaningful Nemotron workflows/tool use, and Capital One meaningful Nessie sandbox integration. Treat these as project objectives; re-check current official judging rules before making eligibility claims.

## The six agreed priorities

1. Data foundation: select one customer, normalize their Nessie records, and distinguish missing inputs from zero.
2. Financial health: net worth, emergency coverage, debt burden, cash flow and minimum projected cash with visible inputs/formulas.
3. Detections: cash shortages, bill pressure, emergency shortfalls, debt burden, spending changes and goal conflicts.
4. Nemotron workflow: bounded Coordinator, Strategist and Coach roles using verified financial tools.
5. Cross-goal comparison: show checking safety, optional loan payoff estimates, emergency savings and house/other goal implications; offer safer amounts/dates.
6. Decision Receipt and approval: save evidence, alternatives, assumptions and checks; preview a supported app change and apply it exactly once after user approval.

The intended demo question is: “Can I afford an extra $300 payment toward my loan while staying on track for my house?” Demonstrate a rejected unsafe option, safer alternative, receipt, and approved app setting.

## Actual system architecture

```text
Claude HTML UI + support.js
        ↓ same-origin HTTP API
Node server: demo session / ownership / validation
        ├── Nessie v2 adapter → customer-scoped saved snapshot
        ├── declared profile and goal plans
        ├── deterministic finance + intelligence modules
        ├── Coordinator → tools/verifier → Strategist → Coach
        └── saved receipt → proposal → explicit approval → update + audit
                              SQLite
```

The actual stack is JavaScript ES modules, Node 22.13+, built-in HTTP/fetch/SQLite, and the supplied HTML/React runtime. No dependency installation is required. The original planned stack was TypeScript, Next.js, Zod, Supabase Auth/Postgres and a monorepo; that migration has not occurred.

Responsibilities:

| File | Purpose |
|---|---|
| `backend/server.mjs` | HTTP routes, local sessions, persistence, approvals and audit |
| `backend/nessie.mjs` | Read-only provider access, pagination, selection and normalization |
| `backend/finance.mjs` | Fixture, integer money validation, daily forecast and basic findings |
| `backend/intelligence.mjs` | Profile validation, health enrichment, detectors, goal comparisons and loan estimates |
| `backend/agents.mjs` | Hosted Nemotron calls, role sequence, allowlisted plan/selection checks |
| `frontend/index.html` | Sidekick, dashboard, assumptions/goals editor, customer choice and receipts |
| `scripts/setup_keys.py` | Saves credentials locally without putting them in source |
| `scripts/verify_demo.mjs` | Isolated live end-to-end sandbox check |

SQLite tables include sessions, goals, actions, audit, profiles, snapshots, receipts, and action_context. Successful receipts and snapshots persist. Running task bookkeeping is still an in-memory Map; this is not a durable background-job system.

## Nessie specifics

- Base URL: `https://v2-prod-api.nessieisreal.com`.
- Authentication: backend `Authorization: Bearer ...` using `NESSIE_API_KEY`; no key in browser/query string.
- Read endpoints: `/customers`, `/accounts`, `/bills`, `/loans`, `/transactions`.
- Lists use `items` and cursor pagination. The adapter deduplicates by ID and fails when its bounded import limit is exceeded rather than presenting a truncated import as complete.
- UI explicitly chooses the customer. Accounts are filtered by customer ID; related bills, active loans and transactions are filtered by owned account IDs.
- Snapshot exposes normalized accounts, loans and transactions for inspection. Transactions between owned accounts are excluded from income/expense; refunds offset expenses. This is basic transaction-type normalization, not learned merchant categorization.
- The user's seed request to `/data/seed` created two customers, four accounts, two merchants, two bills and one loan.
- Seeded first customer: checking $2,500, savings $10,000, credit card owed $42.50, auto loan amount $12,000; net worth $457.50 under the current formula. The other customer has $800 checking and is excluded when first customer is selected. These are historical verification values, not constants to hard-code.
- The seed did not supply sufficient completed expense history. Emergency coverage therefore needs declared essentials and remains unknown otherwise.
- Nessie supplies synthetic banking data, not a real bank connection. NextMove performs no Nessie banking writes. The user separately authorized/ran seeding.

## Finance assumptions and limitations

- Money uses integer cents. Forecast dates come from the snapshot. The current live as-of date uses UTC; the product's intended timezone is America/Chicago. Reconcile this before date-sensitive polish.
- Net worth sums posted checking and savings minus card balances and active loan amounts. Nessie's loan amount is not independently verified remaining principal. Other assets are not modeled.
- Forecast uses posted opening checking balance and dated upcoming bills/fixture events. Outflows precede inflows on the same day. Historical transactions are not replayed against a current balance.
- Declared monthly income supports debt-burden calculations, but is not automatically turned into a dated payday schedule. Pending holds and undeclared future obligations are not modeled.
- Essential spending is explicitly supplied, not inferred from every outgoing transaction. Blank values remain unknown. Recent history totals represent fetched records, not a guarantee of a complete financial history.
- Optional loan inputs: outstanding principal, monthly payment and APR. Payoff calculation assumes an upfront extra payment, monthly interest rounded to cents, fixed rate/payment and no fees. Non-amortizing loans or missing terms return unknown. Exact date-sensitive loan accrual is not implemented.
- Goals have target, amount saved, monthly contribution and optional deadline. Projections use 30-day months and no investment return.
- Current cross-goal tradeoff is deliberately limited: a cash-floor shortfall is hypothetically allocated against one month's goal contributions in listed order. This shows possible goal delay, but does not alter the cash forecast or make a blocked payment safe. Savings remain unchanged because the payment leaves checking.
- The approval action changes the first goal's ongoing contribution preference. Its timeline effect differs from the simulator's one-month hypothetical reduction. Both should remain explicit in UI.
- Detectors cover cash-floor/negative-cash conditions, emergency coverage, high declared debt burden, spending growth between two activity windows, stale feed, missing essential spending and late goal deadlines. The broader original registry is unfinished. No scheduled monitoring runs in the background.

## Nemotron implementation

- NVIDIA endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`.
- Configured live model used successfully: `nvidia/nemotron-3.5-super-vl-120b-a12b`. Code fallback is `nvidia/nemotron-3-nano-30b-a3b` if NVIDIA_MODEL is unset; do not confuse that fallback with the actual configured model.
- Coordinator chooses compare/explain/clarify and extracts an explicit payment amount/date. It receives snapshot date and goal context; comparison tools retrieve the rest of the saved profile.
- Deterministic alternatives compute baseline/requested and, when needed, a smaller payment or later date. The verifier computes allowed options.
- Strategist selects only a supplied allowed scenario. An unsafe/nonexistent selection fails validation.
- Coach explains compact verified context. Receipt figures are taken from code. Coach text has a length check and rejects digits/currency/percent symbols; this is a limited output guard, not a complete semantic fact checker.
- Payment flow uses three model calls; explanation uses two; clarification uses one. Four-call ceiling and shared 45-second timeout. There is no recursive delegation.
- JSON plans are host-dispatched over chat completions; do not claim native function calling. No formal TypeScript/Zod contracts yet.
- Settings: temperature 0.2, max_tokens 2048, stream false, chat_template_kwargs.enable_thinking false. A prior live failure was truncated JSON; compact inputs and this setting fixed the tested path.
- A second live issue was needless clarification for saved financial details; the Coordinator prompt/context was corrected and the full demo then passed.
- No model training, Brev GPU deployment, RAG store, or architecture benchmark has been performed. The planned 20-case model evaluation is still future work.

## API and approval contracts

- `POST /api/v1/demo-session`: obtain/reuse a local demo cookie.
- `GET /api/v1/customers`: list sandbox customer choices.
- `POST /api/v1/sync` with customerId: read and persist selected customer's snapshot.
- `GET /api/v1/snapshot`: enriched snapshot, profile and goal version.
- `PUT /api/v1/profile`: save declared inputs/goals and increment snapshot version.
- `POST /api/v1/scenarios`: snapshot identity/version plus explicit payment change.
- `POST /api/v1/runs`: snapshot identity/version, message and optional selected context.
- `GET /api/v1/receipts`: last twenty saved receipts for the session.
- `POST /api/v1/actions`: contribution amount and optional current receiptId; returns preview/hash/version/expiry.
- `POST /api/v1/actions/:id/approve`: explicit approval with hash and expected versions.

Approval checks session ownership, hash, expiry, goal version, stored snapshot identity/version and supported contribution reduction. An attached receipt must belong to the session and match current snapshot/goal versions. Goal update, action completion, audit and linked receipt update are committed together. Repeated approval returns completed without another update. If the snapshot changes while a model run is executing, the result is rejected as stale.

Profiles and snapshots are session-scoped. Customer selection is a demo dataset choice, not production identity authorization. Changing customers keeps the session's declared assumptions; review them after switching.

## Current UI

Preserve Claude's Sidekick drawer, contextual glossary popovers, financial overview, forecast chart, payment comparison and goal approval presentation. The local expansion adds a data/plans panel with customer choices, editable assumptions and multiple goals, health formulas, account/activity inspection, goal/loan effects and saved receipts.

Browser inspection confirmed the new controls rendered and customer selection loaded the three-account snapshot. Complete visual/interaction QA remains, especially mobile layout, newly saved profiles, receipt selection and approval presentation. The added controls are functional but have not received a full Claude visual design pass.

## Verification and exact stopping point

Completed:
- Eleven automated tests passed, including deterministic finance, customer selection, transfer exclusion, goal impacts, loan estimates, unsafe model selection rejection, session/profile isolation, stale approvals and repeated approval.
- Authorized live end-to-end script passed: customer selection → two declared goals → unsafe payment rejection → three real Nemotron roles → allowed choice → persisted receipt → approved local goal change → repeat approval without duplicate application.
- User explicitly approved sending the seeded Nessie scenario data to the configured NVIDIA endpoint for this live check after automatic approval review requested confirmation. This is approval for the sandbox check, not arbitrary real financial records.
- README, status and implemented-workflow docs were updated.
- The completed server was restarted at `http://127.0.0.1:3002/`. A verification server may also remain on port 3003. Last observed PIDs were 10606 (3002) and 10476 (3003); verify before using these IDs.

Interrupted/remaining:
1. Final browser check at port 3002 after the restart. The user requested this handoff before it was completed.
2. Review diff for edge cases and confirm working-tree contents. All expansion edits remain uncommitted.
3. Update any stale API handoff documentation, particularly docs/FRONTEND-HANDOFF.md.
4. Commit the finished expansion. GitHub previously received only the initial app and Sidekick UI; do not claim the new work is pushed until an actual push succeeds. The user previously authorized the HackUtd2026 repository and pushing the app, but inspect current task authorization before further external changes.

Useful commands from the app directory:

```sh
npm test
npm run dev
NEXTMOVE_URL=http://127.0.0.1:3002 node scripts/verify_demo.mjs
git status --short
git diff --check
```

## Boundaries and follow-up review priorities

- Preserve .env and nextmove.sqlite. Both are ignored. Never print, paste, commit or ask the user to resend saved keys. Keep credentials backend-only.
- This is a local anonymous-session demo, not production authentication/authorization or a public deployment.
- The six priorities have working implementations with the limitations above. Do not represent them as the original platform being complete.
- Remaining original features include rich historical filters, full account drill-down, automated categorization, dated income schedules, a complete detector registry, AI-controlled visualization, durable run jobs, full evidence validation, comprehensive model evaluations and production auth.
- Review cross-goal modeling before claiming genuine shared-budget optimization: current contribution diversion is illustrative and does not reserve money in the forecast. Review loan-date assumptions before claiming exact interest savings for delayed payments.
- Review pending holds, source schema validation, incomplete import disclosure, timezone behavior and goal-version persistence before broader use.
- Do not add unrelated infrastructure or redesign the entire frontend merely to satisfy the old stack preference. Keep working integrations and improve in reviewable increments.
