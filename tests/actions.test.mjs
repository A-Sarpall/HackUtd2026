import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fixture, goalProgress, monthlyLeftover, formatCents} from '../backend/finance.mjs';
import {enrich, reviewFacts, fillPlaceholders} from '../backend/intelligence.mjs';
import {runActionReview} from '../backend/agents.mjs';

const GOAL = {id: 'g', kind: 'emergency', name: 'Emergency fund', targetCents: 300000, savedCents: 60000, monthlyCents: 30000};
const demo = (profile = {goals: [GOAL]}, planned = []) => enrich(fixture(), profile, planned);

test('finance computes goal progress, budget and display formatting in integer cents', () => {
  assert.deepEqual(goalProgress({...GOAL, deadline: '2027-01-01'}, 30000, '2026-11-07'),
    {id: 'g', name: 'Emergency fund', targetCents: 300000, savedCents: 60000, remainingCents: 240000, percentSaved: 20, monthlyCents: 30000, months: 8, reachDate: '2027-07-05', deadline: '2027-01-01', onTrack: false});
  assert.equal(goalProgress(GOAL, 0, '2026-11-07').months, null);
  assert.equal(monthlyLeftover({monthlyIncomeCents: 300000, essentialMonthlyCents: 100000, debtPaymentsCents: 60000}, 30000), 110000);
  assert.equal(monthlyLeftover({monthlyIncomeCents: 300000, essentialMonthlyCents: null, debtPaymentsCents: 60000}, 30000), null);
  assert.equal(formatCents(123456789), '$1,234,567.89');
  assert.equal(formatCents(-5), '−$0.05');
});

test('planned payments enter the forecast and reduce what is owed', () => {
  const s = demo({goals: []}, [{id: 'p1', amountCents: 30000, date: '2026-11-15'}]);
  assert.ok(s.events.some(e => e.id === 'planned-p1' && e.cents === -30000));
  assert.equal(s.debt.currentCents, 170000);
  assert.equal(s.debt.label, 'total owed');
  const facts = reviewFacts(s, {kind: 'debt_payment', amountCents: 10000, date: '2026-11-20'});
  assert.equal(facts.comparison.debtBeforeCents, 170000);
  assert.equal(facts.comparison.debtAfterCents, 160000);
  assert.throws(() => reviewFacts(s, {kind: 'debt_payment', amountCents: 170001, date: '2026-11-20'}), /PAYMENT_EXCEEDS_DEBT/);
});

test('loan terms produce interest savings for the review', () => {
  const s = demo({goals: [], loan: {principalCents: 500000, paymentCents: 20000, aprBps: 2000}});
  const r = reviewFacts(s, {kind: 'debt_payment', amountCents: 30000, date: '2026-11-15'});
  assert.equal(r.comparison.debtLabel, 'loan balance');
  assert.equal(r.comparison.debtAfterCents, 470000);
  assert.ok(r.comparison.interestSavingsCents > 0);
  assert.ok(r.facts.interest_saved.startsWith('$'));
});

test('placeholders are the only way figures can appear in AI text', () => {
  const facts = {amount: '$300.00', date: 'Nov 15'};
  assert.equal(fillPlaceholders('Paying {amount} on {date} is fine.', facts), 'Paying $300.00 on Nov 15 is fine.');
  assert.throws(() => fillPlaceholders('Paying 300 dollars is fine.', facts), /UNVERIFIED_NUMBER/);
  assert.throws(() => fillPlaceholders('Paying $ is fine.', facts), /UNVERIFIED_NUMBER/);
  assert.throws(() => fillPlaceholders('Paying {interest_saved} is fine.', facts), /UNKNOWN_PLACEHOLDER/);
});

test('review workflow: verifier blocks, strategist picks only safe options, coach cannot contradict policy', async () => {
  const s = demo();
  const blockedToday = {kind: 'debt_payment', amountCents: 30000, date: '2026-11-07'};
  const calls = [];
  const provider = (strategist, coach) => async (role, prompt, data) => { calls.push(role); return role === 'Strategist' ? strategist : coach; };
  const ok = await runActionReview(s, blockedToday, {complete: provider({selected: 'deferred'}, {verdict: 'not_recommended', text: 'Paying {amount} today would leave checking at {lowest_balance}, below your {cushion} cushion. Paying on {later_date} keeps you safe.'})});
  assert.equal(ok.policy, 'blocked');
  assert.equal(ok.selected, 'deferred');
  assert.equal(ok.approvalRequired, false);
  assert.match(ok.summary, /\$300\.00 today would leave checking at −\$100\.00, below your \$200\.00 cushion\. Paying on Nov 15/);
  assert.deepEqual(ok.trace.map(t => t.role), ['Financial engine', 'Verifier', 'Strategist', 'Coach']);
  assert.deepEqual(calls, ['Strategist', 'Coach']);
  await assert.rejects(runActionReview(s, blockedToday, {complete: provider({selected: 'deferred'}, {verdict: 'good_idea', text: 'Go ahead.'})}), /INVALID_VERDICT/);
  await assert.rejects(runActionReview(s, blockedToday, {complete: provider({selected: 'requested'}, {verdict: 'not_recommended', text: 'No.'})}), /INVALID_MODEL_SELECTION/);
  await assert.rejects(runActionReview(s, blockedToday, {complete: provider({selected: 'deferred'}, {verdict: 'not_recommended', text: 'You would be 100 short.'})}), /UNVERIFIED_NUMBER/);
  await assert.rejects(runActionReview(s, blockedToday, {complete: provider({selected: 'deferred'}, {verdict: 'not_recommended', text: 'No.', extra: 1})}), /INVALID_MODEL_SCHEMA/);
  // An allowed payment skips the Strategist: one model call.
  calls.length = 0;
  const allowed = await runActionReview(s, {kind: 'debt_payment', amountCents: 30000, date: '2026-11-15'}, {complete: provider(null, {verdict: 'good_idea', text: 'Paying {amount} on {date} keeps you above your {cushion} cushion.'})});
  assert.equal(allowed.policy, 'allowed');
  assert.deepEqual(calls, ['Coach']);
});

test('calculator-only review explains the action with verified figures', async () => {
  const prev = process.env.NVIDIA_API_KEY; delete process.env.NVIDIA_API_KEY;
  try {
    const r = await runActionReview(demo(), {kind: 'debt_payment', amountCents: 200000, date: '2026-11-07'});
    assert.equal(r.provenance.mode, 'deterministic');
    assert.equal(r.verdict, 'not_recommended');
    assert.match(r.summary, /Paying \$2,000\.00 on Nov 7 would bring checking to −\$1,800\.00 on Nov 11, which is \$2,000\.00 below your \$200\.00 safety cushion\./);
    const goal = await runActionReview(demo(), {kind: 'goal_contribution', amountCents: 50000});
    assert.equal(goal.verdict, 'caution');
    assert.match(goal.summary, /At \$500\.00 a month, Emergency fund would reach its target in 5 months instead of 8 months\./);
    assert.match(goal.summary, /Add your take-home pay/);
  } finally { if (prev !== undefined) process.env.NVIDIA_API_KEY = prev; }
});

test('API: payments and goal changes are proposed, checked and approved once', async () => {
  const env = {...process.env, PORT: '3092', DATABASE_PATH: ':memory:'}; delete env.NVIDIA_API_KEY; delete env.NESSIE_API_KEY;
  const child = spawn(process.execPath, ['--experimental-sqlite', 'backend/server.mjs'], {env, stdio: ['ignore', 'pipe', 'pipe']});
  try {
    await once(child.stdout, 'data');
    let cookie;
    const call = async (path, method = 'GET', body) => {
      const r = await fetch('http://127.0.0.1:3092/api/v1' + path, {method, headers: {'Content-Type': 'application/json', ...(cookie ? {cookie} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
      cookie ??= r.headers.get('set-cookie')?.split(';')[0];
      return {status: r.status, data: await r.json()};
    };
    await call('/demo-session', 'POST', {});
    let snap = (await call('/snapshot')).data;
    assert.equal(snap.goalProgress.percentSaved, 20);
    assert.equal(snap.debt.currentCents, 200000);

    // Blocked payment cannot be proposed; Sidekick review still explains it.
    const blocked = await call('/actions', 'POST', {kind: 'debt_payment', amountCents: 30000, date: '2026-11-07'});
    assert.equal(blocked.status, 422); assert.equal(blocked.data.error.code, 'BELOW_CUSHION');
    const review = await call('/reviews', 'POST', {snapshotId: snap.id, snapshotVersion: snap.version, action: {kind: 'debt_payment', amountCents: 30000, date: '2026-11-07'}});
    assert.equal(review.status, 200); assert.equal(review.data.receipt.verdict, 'not_recommended'); assert.equal(review.data.receipt.selected, 'deferred');
    assert.ok(!/[{}]/.test(review.data.receipt.summary));
    assert.equal((await call('/actions', 'POST', {kind: 'debt_payment', amountCents: 999999, date: '2026-11-15'})).status, 400);

    // Allowed payment: propose, approve once, appears in the plan.
    const p = (await call('/actions', 'POST', {kind: 'debt_payment', amountCents: 30000, date: '2026-11-15'})).data;
    assert.equal(p.comparison.debtAfterCents, 170000);
    const approval = {proposalHash: p.proposalHash, expectedGoalVersion: p.expectedGoalVersion, snapshotVersion: p.snapshotVersion};
    assert.equal((await call(`/actions/${p.id}/approve`, 'POST', approval)).status, 200);
    assert.equal((await call(`/actions/${p.id}/approve`, 'POST', approval)).status, 200);
    snap = (await call('/snapshot')).data;
    assert.equal(snap.plannedPayments.length, 1);
    assert.equal(snap.debt.currentCents, 170000);
    assert.equal(snap.version, p.snapshotVersion + 1);
    assert.ok(snap.events.some(e => e.id === 'planned-' + p.id));
    // Removing it restores the outlook.
    snap = (await call(`/planned-payments/${p.id}`, 'DELETE', {})).data;
    assert.equal(snap.plannedPayments.length, 0); assert.equal(snap.debt.currentCents, 200000);

    // Goal increase allowed within budget, refused above it.
    snap = (await call('/profile', 'PUT', {monthlyIncomeCents: 300000, essentialMonthlyCents: 100000, debtPaymentsCents: 60000, goals: [{...GOAL, id: 'example-emergency'}]})).data;
    assert.equal(snap.budget.leftoverCents, 110000);
    const over = await call('/actions', 'POST', {kind: 'goal_contribution', amountCents: 200000});
    assert.equal(over.status, 422); assert.equal(over.data.error.code, 'OVER_BUDGET');
    const up = (await call('/actions', 'POST', {kind: 'goal_contribution', amountCents: 50000})).data;
    assert.equal(up.progressNew.months, 5); assert.equal(up.leftoverNewCents, 90000);
    assert.equal((await call(`/actions/${up.id}/approve`, 'POST', {proposalHash: up.proposalHash, expectedGoalVersion: up.expectedGoalVersion, snapshotVersion: up.snapshotVersion})).status, 200);
    snap = (await call('/snapshot')).data;
    assert.equal(snap.goal.amountCents, 50000); assert.equal(snap.goalProgress.months, 5);
  } finally { child.kill(); }
});
