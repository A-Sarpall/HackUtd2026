import {test} from 'node:test';
import assert from 'node:assert/strict';
import {koinDemo} from '../backend/finance.mjs';
import {enrich, reviewFacts} from '../backend/intelligence.mjs';
import {runActionReview} from '../backend/agents.mjs';

// $1,520 checking, $200 cushion; a $60 card payment on the 20th; $1,940 left each month after bills and debts.
const PROFILE = {goals: [], monthlyIncomeCents: 300000, essentialMonthlyCents: 100000, debtPaymentsCents: 6000, habitSpendingCents: 0,
  debts: [{id: 'card', name: 'Credit card', balanceCents: 200000, aprBps: 2400, monthlyCents: 6000}],
  planFlows: [{id: 'debt-card', label: 'Credit card payment', cents: -6000, every: 20}]};
const snap = (profile = PROFILE) => ({...enrich(koinDemo(), profile), profile});

test('raising a debt payment is checked on its payment day and shortens payoff', () => {
  const r = reviewFacts(snap(), {kind: 'debt_monthly', debtId: 'card', changeCents: 4000});
  assert.equal(r.policy, 'allowed');
  assert.equal(r.facts.new_amount, '$100.00');
  assert.equal(r.facts.lowest_balance, '$1,420.00');
  assert.equal(r.facts.lowest_date, 'Nov 20');
  assert.equal(r.facts.leftover_new, '$1,900.00');
  assert.ok(r.comparison.payoffMonthsNew < r.comparison.payoffMonthsNow);
  assert.ok(r.facts.interest_saved);
});

test('a raise that dips under the cushion is blocked and offers the largest amount that fits', () => {
  const r = reviewFacts(snap(), {kind: 'debt_monthly', debtId: 'card', changeCents: 130000});
  assert.equal(r.policy, 'blocked');
  assert.ok(r.warnings.includes('below_cushion'));
  assert.deepEqual(r.options.smaller, {changeCents: 126000, policy: 'allowed'});
  assert.equal(r.facts.shortfall, '$40.00');
});

test('lowering a debt payment is allowed but flagged as slower payoff; unknown rate stays unknown', () => {
  const r = reviewFacts(snap(), {kind: 'debt_monthly', debtId: 'card', changeCents: -6000});
  assert.equal(r.policy, 'allowed');
  assert.ok(r.warnings.includes('slower_payoff'));
  assert.equal(r.facts.months_new, null);
  const u = reviewFacts(snap({...PROFILE, debts: [{...PROFILE.debts[0], aprBps: null}]}), {kind: 'debt_monthly', debtId: 'card', changeCents: 4000});
  assert.ok(u.warnings.includes('apr_unknown'));
  assert.equal(u.facts.months_now, null);
  assert.throws(() => reviewFacts(snap(), {kind: 'debt_monthly', debtId: 'loan', changeCents: 100}), /NO_DEBT/);
  assert.throws(() => reviewFacts(snap(), {kind: 'debt_monthly', debtId: 'card', changeCents: 0}), /INVALID_AMOUNT/);
});

test('the agents review a debt payment change with verified figures only', async () => {
  const out = await runActionReview(snap(), {kind: 'debt_monthly', debtId: 'card', changeCents: 4000}, {complete: async () =>
    ({verdict: 'good_idea', text: 'Paying {change} more toward your {debt_name} keeps checking at {lowest_balance} at its lowest.'})});
  assert.equal(out.verdict, 'good_idea');
  assert.equal(out.summary, 'Paying $40.00 more toward your Credit card keeps checking at $1,420.00 at its lowest.');
  assert.deepEqual(out.trace.map(t => t.tool).slice(0, 2), ['project_debt_plan', 'cash_floor_and_budget_check']);
  assert.deepEqual(out.action, {kind: 'debt_monthly', debtId: 'card', changeCents: 4000, date: null});
});
