# Implemented personal finance workflow

## Run locally

Use Node 22.13 or newer, save keys with scripts/setup_keys.py, and run npm run dev. The saved PORT controls the local address. The main development preview is currently on port 3002; port 3003 was used for isolated verification. No additional packages are required.

1. Open Data & goals and select Show sandbox customers, then choose one. Each local session stores its selected customer's financial snapshot.
2. Open Income, bills and goals. Enter known monthly take-home pay, essential bills, debt payments, safety cushion (cash floor), and optional loan terms. Blank fields mean unknown.
3. Add house, emergency, or other goal plans with target, saved amount, monthly contribution, and optional deadline.
4. Compare an extra payment. Cash forecasts, loan estimates, emergency coverage, and hypothetical contribution trade-offs are computed in code.
5. Ask Sidekick about a payment. Coordinator interprets the request, Strategist selects an allowed calculated option, and Coach explains it. The verifier rejects an unsafe model selection.
6. Open Decision receipts for evidence, scenario results, assumptions, checks, and public role/tool activity.
7. Select a current receipt, review a contribution reduction, and approve it. This edits the first goal's ongoing app contribution preference. Repeated approval returns the original result without applying twice.

## Data and calculations

- Nessie: customers, accounts, bills, loans, transactions; explicit customer selection and related-account filtering. Lists paginate and deduplicate by provider ID; exceeding the bounded import limit fails instead of silently truncating.
- Net worth: posted checking plus savings minus listed credit card balances and active loan amounts. Loan amount is not independently verified remaining principal. Other asset classes are excluded.
- Emergency coverage: savings divided by declared essential monthly spending. Transactions are not automatically labeled essential.
- Debt burden: declared monthly debt payments divided by declared take-home income.
- History: completed recent inflows/outflows, with transfers between the selected customer's accounts excluded and refunds offsetting expenses.
- Cash forecast: posted opening checking balance plus upcoming imported bills and fixture events. Declared monthly income is a ratio input; it is not a dated payday schedule. Pending holds and undeclared future obligations are not modeled.
- Loan estimate: optional declared outstanding principal, APR in basis points, monthly payment, rounded monthly interest, upfront extra payment, no fees, maximum 600 months. Missing terms or non-amortizing payments produce unknown results.
- Goal comparison: 30-day months, fixed declared contributions, no investment returns. A cash-floor shortfall is hypothetically allocated against one month's contributions in listed order. The cash forecast still shows the original payment as blocked; the hypothetical reduction is not a bank transfer or a claim that the payment became affordable.
- Approval changes an ongoing contribution setting; the preview therefore shows its ongoing timeline effect. This differs explicitly from the simulator's one-month hypothetical reduction.

## Detectors and model workflow

Cash-floor breaches, negative cash, insufficient emergency coverage, high declared debt burden, spending increase versus the previous 30 days, stale provider data, missing essential spending, and late goal deadlines. Spending comparison needs activity in both windows. Findings refresh with data/profile changes; there is no background polling job.

The same configured hosted Nemotron model serves Coordinator, Strategist, and Coach. Payment runs use three calls; concept explanations use two; clarification uses one. Code enforces a four-call ceiling and a shared 45-second deadline. Communication uses JSON over chat completions with host dispatch, not native function-call messages. Deterministic alternatives include smaller payments and later safe dates. The Coach receives compact verified context; figures shown in the receipt come directly from the calculator.

## Persistence and scope

SQLite stores demo sessions, profiles, snapshots, receipts, proposals, action context, and audits. Models cannot execute approval. Server checks ownership, proposal hash, expiry, goal version, stored snapshot identity/version, and allowed contribution reduction. Receipt selection also checks current snapshot and goal version.

This remains a local hackathon application with anonymous demo sessions. Sandbox selection is not production identity authorization. A failed provider read preserves the saved snapshot. Customer switching should be treated as switching a demo dataset; the session's declared profile stays in place and should be reviewed.

## Verification

npm test covers deterministic calculations, customer selection, transfers, model-selection rejection, cross-goal effects, loan estimates, session isolation, profile changes, stale approvals, and repeated approvals.

scripts/verify_demo.mjs creates an isolated local session and reads Nessie, declares synthetic assumptions and goals, runs live Nemotron, persists a receipt, and verifies a local approval and repeat approval. It performs no bank writes. Run only when sending the sandbox scenario to NVIDIA is authorized.
