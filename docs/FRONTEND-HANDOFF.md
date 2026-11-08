# Claude frontend handoff

The current frontend is the supplied Sidekick HTML UI plus support.js, served by the Node backend at http://127.0.0.1:3002. Preserve its design and use same-origin /api/v1 requests with the demo session cookie. No Next.js proxy is required by the current implementation.

## Current API

- POST /api/v1/demo-session with {} creates or reuses a local demo session.
- GET /api/v1/customers returns {customers}; explicitly choose a sandbox customer.
- POST /api/v1/sync with {customerId} imports and saves that customer's snapshot. Success returns {ok,mode,snapshot,provider}. Empty provider data returns snapshot:null and empty:true. Failures preserve the saved snapshot.
- GET /api/v1/snapshot returns the enriched snapshot, metrics, findings, forecast, profile, goals and goal {amountCents,version}. Use its actual id, version and asOf; never hard-code fixture values.
- PUT /api/v1/profile saves declared assumptions and goal plans, increments snapshot version and returns the enriched snapshot. Blank inputs mean unknown. The first goal supplies the ongoing contribution preference. Refresh displayed versions after saving.
- POST /api/v1/scenarios with {snapshotId,snapshotVersion,changes:[{kind:"extra_debt_payment",amountCents,date}]} returns {baseline,scenario}. A single payment includes goal and optional loan effects. Stale snapshots return 409.
- POST /api/v1/runs with {snapshotId,snapshotVersion,message,context?} waits for the bounded model workflow and returns {runId,status,receipt?,error?}. Render failed/unavailable results honestly. GET /api/v1/runs/{id} retrieves a session-owned run while this process remains alive.
- GET /api/v1/receipts returns the latest twenty persisted session receipts.
- POST /api/v1/actions with {amountCents,receiptId?} previews a contribution reduction. Returns id, proposalHash, expectedGoalVersion, snapshotVersion, expires, oldAmountCents, newAmountCents and goalImpact. A selected receipt must belong to this session and match current snapshot and goal versions.
- POST /api/v1/actions/{id}/approve with {proposalHash,expectedGoalVersion,snapshotVersion} applies the preview once. Refresh snapshot afterward. Repeated approval of the same action returns completed; stale proposals return 409.

## Presentation boundaries

Money is integer cents and financial figures come from API results. Missing loan terms and essential spending remain unknown. Customer switching retains declared assumptions; prompt users to review them. Source labels must distinguish fixtures and Nessie sandbox data.

Comparison goal effects describe a hypothetical one-month contribution diversion and do not make a blocked payment safe. Approval changes the first goal's ongoing contribution preference, so its timeline differs. No bank payment or transfer occurs. Only a user approval may apply a proposal.

## Verification status

Continuation review: all eleven automated tests passed with local-server permissions. The existing port-3002 dashboard and a $300 comparison rendered successfully against its saved sandbox snapshot. Full mobile, profile-save, receipt-selection and approval presentation QA remains outstanding. This review did not repeat live NVIDIA calls or push changes.
