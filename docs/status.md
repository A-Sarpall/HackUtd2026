# Implementation status

Six-priority expansion implemented locally:
- Explicit Nessie customer selection, normalized records, session-specific saved snapshots.
- Financial health metrics, declared profile inputs, historical cash flow.
- Refresh-driven cash, debt, spending, missing-data and goal-deadline findings.
- Coordinator, Strategist and Coach using the configured Nemotron endpoint and deterministic verification.
- Multiple goal plans, cash comparisons, hypothetical contribution trade-offs and optional loan payoff estimates.
- Persisted receipts, evidence, alternatives and checks, linked contribution approvals with audit and repeat protection.

See IMPLEMENTED-WORKFLOW.md for precise assumptions and limits. API additions: GET /api/v1/customers; PUT /api/v1/profile; GET /api/v1/receipts. Sync accepts customerId. Runs produce saved receipts; proposals accept an optional current receiptId. Existing snapshot/scenario/action routes remain.

Production authentication, bank writes, automated categorization and scheduled monitoring are outside this local implementation.

Verification: all 11 automated checks passed. The live end-to-end script passed with seeded Nessie data, two declared goals, three live Nemotron roles, rejection of the unsafe payment, a saved receipt, and exactly-once local goal approval.

## Coding guardrails (November 8, 2026)

Added root AGENTS.md with the supplied NextMove coding guardrails, matching the existing CLAUDE.md verbatim. Documentation only; runtime behavior and API contract v1 are unchanged. Existing implementation gaps remain as documented in IMPLEMENTED-WORKFLOW.md.

Verification: confirmed the two guardrail files match byte-for-byte and checked the added documentation for whitespace errors. Runtime tests, types, lint and build were not run for this documentation-only change. No new integration dependency.

## Implemented guardrail fixes (November 8, 2026)

API contract remains v1; no route or request-field changes. Test-injected model providers now report test_provider provenance rather than live.

Implemented: exact provider-dollar parsing; safe-integer checks on forecast, history and aggregate money; integer loan-interest rounding; finance-owned approval preview; strict model role fields and clarification validation; shared deadline for injected providers; six-tool ceiling alongside existing four-model ceiling; failed/stale run receipt removal; atomic proposal/context insertion; snapshot-bound proposal hash; fresh state after request-body reads; concurrent sync stale-state rejection; goal removal clears contribution and increments goal version. No automatic correction or external-write retry was added.

Changed implementation files: backend/finance.mjs, backend/intelligence.mjs, backend/nessie.mjs, backend/agents.mjs, backend/server.mjs. Added tests/guardrails.test.mjs and expanded tests/profile.test.mjs. Existing uncommitted work preserved.

Verification: npm test passed all 15 tests, including session ownership, stale approvals, repeated approval, model selection, provider timeout, invalid model fields, money precision/overflow and cleared goals. Initial restricted run could not bind API-test ports; the full run with local server access passed. node --check passed for server and agents; git diff --check passed. No live provider calls or browser QA were run. Type/lint/build scripts are not configured in this JavaScript repository.

Remaining limits: this is not full compliance with the target architecture. Strict TypeScript and shared typed contracts, complete external-record schemas, semantic verification of model prose, production identity, and broader UI-state verification remain unimplemented. The existing intelligence module still holds financial calculations; consolidation into the target finance package needs the shared contract migration. No new integration dependencies introduced.

## Interface wording pass (November 8, 2026)

API contract remains v1; no routes, request fields or response fields changed. Only user-facing text changed, plus one error-mapping fix.

Implemented: shorter, plain-language copy across headings, buttons, glossary tooltips, findings, outlook and payment comparison, goal proposal/approval, Sidekick states, decision receipts, settings panel, and error messages. Consistent terms: "safety cushion" (cash floor), "essential bills", "net worth", "extra payment". Data labels now distinguish made-up demo data, recorded walkthrough, Nessie sandbox test data, test-model output, calculator-only replies, and live AI. Goal copy states it changes a monthly NextMove setting and moves no money; goal effects from a blocked payment are labeled hypothetical, and the payment still shows as below the cushion.

Behavior-adjacent fixes: GET /customers now returns the same Nessie error codes and messages as sync, instead of a generic 400 when the key is missing. Sync errors now give code-specific messages; previously every failure said to check the key. The blocked-payment hint now explains the payday rule only when the payday date is selected, and its button uses the computed later date instead of hardcoded "Nov 15". When coverage is unknown, the tooltip says "Not enough information" and tells the user what to enter. The header shows NOT CONNECTED when the server is unreachable. Receipt rows show readable dates, option names and statuses.

Changed files: frontend/index.html, backend/finance.mjs, backend/intelligence.mjs, backend/nessie.mjs, backend/agents.mjs, backend/server.mjs, README.md, docs/IMPLEMENTED-WORKFLOW.md. frontend/support.js is generated and unchanged.

Verification: npm test passed all 15 tests. node --check passed for all backend modules and the extracted frontend script. git diff --check passed. Headless Chrome QA at 1280×900 and 390×844 used a local server with provider keys unset and an in-memory database. It covered loading, ready, glossary, blocked and later-date comparison, proposal and approval, Sidekick calculator-only reply, settings panel with a missing-key provider error, empty and populated receipts, stale snapshot (409), unreachable server, and recorded walkthrough. Insufficient-data copy was checked by intercepting the snapshot response, because the demo fixture always includes essential bills. No live Nessie or NVIDIA calls were made, and no live-AI or test-model receipt was rendered in the browser.

Remaining limits: error codes are still shown in monospace next to messages. Several server failures, such as amount too high or a stale receipt, still collapse into generic INVALID_REQUEST. The runtime logs SVG attribute warnings before the first binding, and one unexplained 401 appeared on the first desktop load; neither is copy-related, and both are unaddressed. The settings panel uses minimal styling. Strict TypeScript, shared contracts, semantic verification of model prose and production identity remain unimplemented, as noted above.

## Public-deployment hardening and workflow view (November 8, 2026)

API contract remains v1. New responses on existing routes: 429 `RATE_LIMITED` / `AI_DAILY_LIMIT` with Retry-After, 403 `ORIGIN_DENIED`, 415 `UNSUPPORTED_MEDIA_TYPE`, 413 `BODY_TOO_LARGE`, 421 `HOST_DENIED` (only with PUBLIC_ORIGIN). `/health` now returns `{ok:true}`. The sessions table gains a `created` column, migrated automatically on startup.

Implemented in backend/server.mjs: configurable HOST, PORT and PUBLIC_ORIGIN; security headers including CSP and HSTS over HTTPS; `__Host-` Secure session cookie with a 7-day expiry and automatic purge of expired session data; Host and Origin checks, a JSON-only rule for writes and a 16 KB body limit; in-memory rate limits per IP, per session and per day for AI; a 50-receipt cap per session; pruning of the in-memory run map; request timeouts; logs that contain only codes and request IDs (no bodies); graceful SIGTERM shutdown. Fixed a keep-alive bug: an early rejection that left the request body unread corrupted the next request on that connection; such responses now close the connection.

Frontend: "How it works" explainer for the five workflow steps (Coordinator, Strategist and Coach are AI; Financial engine and Verifier are code), and a per-answer "How this answer was made" view built only from the server trace, with steps that didn't run shown as skipped. Added messages for the new error codes and a dedicated screen for the session rate limit.

Deployment: Dockerfile (node:22.13.1-bookworm-slim, tag confirmed on Docker Hub), .dockerignore, expanded .env.example, docs/DEPLOY.md. Nothing was deployed.

Verification: npm test passed 19 of 19, including the new tests/security.test.mjs (headers and cookie flags, cross-site/wrong-host/non-JSON rejection, session and run rate limits, session expiry). Headless Chrome at 1280×900 and 390×844 against a server with PUBLIC_ORIGIN set and keys unset: all earlier UI states still pass under the CSP. Checked: explainer, no-AI workflow message, full and skipped workflow rendering, session rate-limit screen. The full five-step trace was rendered from a mocked run response, not a live model. SIGTERM shutdown exited 0. The Docker image was not built (no Docker in this environment). No live NVIDIA or Nessie calls.

Remaining limits: CSP must allow `unsafe-eval` and unpkg.com for the supplied runtime; Chrome logs harmless CSP reports for the raw template's `onClick` attributes. Rate limits are per process and in memory. No edge DDoS protection. No real user accounts. Prose from the AI is not checked for meaning. Strict TypeScript and shared contracts are still not done.

## Workflow explainers (November 8, 2026)

Frontend only (frontend/index.html); API contract v1 unchanged. Added question-style toggles, styled like the assumptions toggle, each showing a backend workflow as connected steps labeled by actor (DATA, YOU, CODE, AI):
- "Where do these numbers come from?": data source, cleanup, your inputs, financial engine. Wording changes with demo, recorded or sandbox mode; shows the snapshot version and date.
- "How does NextMove find these?": seven checks with live status (Flagged, Clear, Needs more data, Not applicable), read from the snapshot's `detectorCoverage` and findings, not recomputed in the browser.
- "How is the outlook built, and how is a payment checked?": forecast and comparison steps, including the verifier's cushion check.
- "What happens when I approve a change?": proposal lock, user approval, server checks, a single saved write with an audit record.
- The assumptions toggle is restyled to match; the Sidekick explainer title is now a question.

Verification: headless Chrome at 1280×900 and 390×844 opened every toggle and checked the text, open state across a re-render, keyboard toggling and horizontal overflow (0 px). Earlier UI regression scripts passed, with no page errors. npm test passed 19 of 19; git diff --check passed. Sandbox-mode text was checked against the code but not rendered with live Nessie data.

## Extra payments, goal changes and Sidekick reviews (November 8, 2026)

API contract v1, additive changes:
- `POST /api/v1/reviews` with `{snapshotId, snapshotVersion, action}`, where action is `{kind:'debt_payment', amountCents, date}` or `{kind:'goal_contribution', amountCents}`. Returns a saved receipt with `kind:'action_review'`, verdict, summary, options, selected alternative, details and trace.
- `POST /api/v1/actions` accepts `kind` (defaults to `goal_contribution`) and `date`. Goal amounts may now go up or down. Blocked actions return 422 `BELOW_CUSHION` or `OVER_BUDGET`. A goal change with no goal returns 400 `NO_GOAL`.
- Approving a `debt_payment` adds it to a new `planned_payments` table and bumps the snapshot version. `DELETE /api/v1/planned-payments/:id` removes it.
- Snapshot adds `plannedPayments`, `debt`, `budget` and `goalProgress`. Scenario results add `amountCents`, `date`, `debtLabel`, `debtBeforeCents`, `debtAfterCents` and `payoffMonthsBefore`.
- The actions table gains `kind` and `date` columns, migrated automatically. New and existing sessions without a saved profile get a labeled example goal.

Behavior:
- **Payment box:** shows the lowest checking balance, what you owe before and after, and (with loan terms) interest saved and payoff time. "Review this payment" runs the review. Allowed payments can be added to the NextMove plan with approval; they appear in the outlook and in a removable list. NextMove never sends money.
- **Goal section:** shows progress (saved vs. target), time to reach the target, deadline status and money left each month. Raising or lowering the amount runs a review. Increases that exceed the known monthly budget can't be approved.
- **Review workflow:** Financial engine → Verifier → Strategist (only when blocked and a verified safer option exists) → Coach. At most 2 model calls, within the existing 4-call, 6-tool and 45-second limits. The Coach may cite figures only through placeholders such as `{lowest_balance}`; the server rejects raw digits, currency symbols or unknown placeholders and fills in verified values. A blocked action must get "not recommended". Without AI, a calculator-only summary built from the same facts is shown and labeled.
- The server re-runs the safety check at approval time.

Verification: npm test passed 26 of 26, including the new tests/actions.test.mjs (goal progress and budget math, planned payments in forecast and debt, loan interest, placeholder validation, Strategist and Coach guardrails with a test provider, calculator-only summaries, API propose, approve-once, remove and over-budget). Headless Chrome at 1280×900 and 390×844 against a keyless server: blocked payment with a safer suggestion, adding a payment to the plan and removing it, a goal raise and an over-budget goal, loan interest display, recorded walkthrough messaging, and all earlier UI regression scripts. No live NVIDIA or Nessie calls: the AI path was tested only with a test provider in unit tests, and the browser showed calculator-only reviews.

Known limits: the finance model's goal-conflict estimate compares against the lowest balance over the whole month, not the balance after the payment date, so it is shown only for blocked payments. Planned payments outside the 30-day window still reduce displayed debt but not the forecast. Verdict and wording from a live model have not been seen in the browser.
