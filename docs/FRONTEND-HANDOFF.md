# Claude frontend handoff

Implement the planned NextMove UI against this existing backend. Do not change financial calculations or invent successful API responses. Use Next.js route rewrites/proxy for /api/v1 to http://127.0.0.1:3001 so cookies stay same-origin. Preserve demo/source labels. Avoid cross-origin browser requests. Design and frontend belong to Claude.

Implemented endpoints:

- POST /api/v1/demo-session with {} creates isolated synthetic cookie session.
- GET /api/v1/snapshot returns fixture, metrics, findings, forecast and goal {amountCents,version}.
- POST /api/v1/scenarios with {snapshotId:"demo-v1",snapshotVersion:1,changes:[{kind:"extra_debt_payment",amountCents:30000,date:"2026-11-07"}]} returns {baseline,scenario}. Compare Nov 15 for deferred alternative.
- POST /api/v1/runs with {snapshotId,snapshotVersion,message,context?} waits synchronously and returns {runId,status,receipt?,error?}. No NVIDIA key produces a truthful deterministic unavailable result. GET /api/v1/runs/{id} retrieves own run.
- POST /api/v1/actions with {amountCents:10000} proposes reducing the unscheduled goal contribution and returns exact old/new values and approval fields.
- POST /api/v1/actions/{id}/approve with {proposalHash,expectedGoalVersion,snapshotVersion} applies once. Refresh snapshot after success. Same action ID provides repeat protection. Stale proposals return 409.
- POST /api/v1/sync currently returns 503 NESSIE_NOT_CONNECTED. Render this honestly.

Amounts are cents. Never make numeric claims beyond API outputs. Approval changes a goal preference only; no bank movement. Display API failures and missing AI clearly. Selected metric explanations and wider scenario types are not implemented yet; do not claim them active. The actual code contract above supersedes proposed contracts until the remaining backend work lands.
