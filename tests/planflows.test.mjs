import {test} from 'node:test';
import assert from 'node:assert/strict';
import {koinDemo} from '../backend/finance.mjs';
import {enrich, validateProfile} from '../backend/intelligence.mjs';
import {runDecision} from '../backend/agents.mjs';

const GOAL = {id: 'emergency', kind: 'emergency', name: 'Emergency fund', targetCents: 300000, savedCents: 60000, monthlyCents: 30000};

test('plan flows become dated forecast events: daily, day of month and every 14 days', () => {
  const profile = validateProfile({goals: [GOAL], goalContributionDay: 15, planFlows: [
    {id: 'habits', label: 'Everyday spending', cents: -1000, every: 'day'},
    {id: 'rent', label: 'Rent', cents: -90000, every: 10},
    {id: 'pay', label: 'Payday', cents: 210000, every: {start: '2026-11-15', days: 14}}]});
  const s = enrich(koinDemo(), profile);
  const on = (label, date) => s.events.filter(e => e.label === label && e.date === date);
  assert.equal(s.events.filter(e => e.label === 'Everyday spending').length, 30);
  assert.equal(on('Rent', '2026-11-10').length, 1);
  assert.deepEqual(s.events.filter(e => e.label === 'Payday').map(e => e.date), ['2026-11-15', '2026-11-29']);
  assert.equal(on('To Emergency fund', '2026-11-15')[0].cents, -30000);
  // Money out before money in on the same day: on Nov 15 spending and the goal contribution land before the paycheck.
  assert.equal(s.forecast.minCashDate, '2026-11-15');
  assert.equal(s.forecast.minCashCents, 152000 - 90000 - 9 * 1000 - 30000);
});

test('invalid plan flows are rejected', () => {
  for (const every of [0, 32, 'week', {start: '2026-11-15', days: 10}, {start: 'soon', days: 14}])
    assert.throws(() => validateProfile({goals: [], planFlows: [{id: 'x', label: 'X', cents: 100, every}]}), /INVALID_PLAN_FLOWS/);
  assert.throws(() => validateProfile({goals: [], planFlows: [{id: 'x', label: 'X', cents: 1.5, every: 'day'}]}), /INVALID_AMOUNT/);
});

test('Kip proposes a pay schedule with verified figures and changes nothing itself', async () => {
  const s = {...enrich(koinDemo(), {goals: []}), profile: {goals: []}};
  const out = await runDecision(s, {message: 'I get paid $2,100 every two weeks'}, {complete: async role => role === 'Coordinator'
    ? {tool: 'set_income', amountCents: 210000, every: 'biweekly', nextDate: '2026-11-15'}
    : {text: 'Got it: {paycheck} {schedule}, about {monthly_income} a month.'}});
  assert.equal(out.kind, 'set_income');
  assert.deepEqual(out.proposedIncome, {amountCents: 210000, every: 'biweekly', nextDate: '2026-11-15'});
  assert.equal(out.summary, 'Got it: $2,100.00 every two weeks, about $4,550.00 a month.');
  await assert.rejects(runDecision(s, {message: 'pay'}, {complete: async role => role === 'Coordinator'
    ? {tool: 'set_income', amountCents: -5, every: 'biweekly', nextDate: null} : {text: 'x'}}), /INVALID_MODEL_PLAN/);
});

test('one-time money lands once, on its date', () => {
  const s = enrich(koinDemo(), validateProfile({goals: [], planFlows: [{id: 'once-a', label: 'Bonus', cents: 50000, every: {date: '2026-11-20'}}]}));
  assert.deepEqual(s.events.filter(e => e.label === 'Bonus').map(e => e.date), ['2026-11-20']);
  assert.throws(() => validateProfile({goals: [], planFlows: [{id: 'x', label: 'X', cents: 1, every: {date: 'later'}}]}), /INVALID_PLAN_FLOWS/);
});

test('surplus split: keep a tenth, emergency first when thin, then highest-rate debt, then other goals', () => {
  const profile = validateProfile({monthlyIncomeCents: 400000, essentialMonthlyCents: 100000, debtPaymentsCents: 20000, habitSpendingCents: 0,
    goals: [{id: 'em', kind: 'emergency', name: 'Emergency fund', targetCents: 300000, savedCents: 0, monthlyCents: 0},
      {id: 'trip', kind: 'other', name: 'Trip', targetCents: 50000, savedCents: 0, monthlyCents: 0}],
    debts: [{id: 'low', name: 'Car loan', balanceCents: 500000, aprBps: 700, monthlyCents: 10000}, {id: 'high', name: 'Card', balanceCents: 40000, aprBps: 2400, monthlyCents: 10000}]});
  const plan = enrich(koinDemo(), profile).surplusPlan;
  // Savings $600 cover under three months of $1,000 essentials, so emergency savings come first.
  assert.equal(plan.surplusCents, 280000);
  assert.equal(plan.keepCents, 28000);
  assert.deepEqual(plan.items.map(x => [x.id, x.cents]), [['em', 126000], ['high', 40000], ['low', 86000]]);
  assert.equal(plan.items.reduce((a, x) => a + x.cents, 0) + plan.keepCents, plan.surplusCents);
  assert.equal(enrich(koinDemo(), {...profile, monthlyIncomeCents: 125000}).surplusPlan, null);
});

test('each agent step records a short finding written by code', async () => {
  const s = {...enrich(koinDemo(), {goals: []}), profile: {goals: []}};
  const out = await runDecision(s, {message: 'How low will checking get?'}, {complete: async role => role === 'Coordinator' ? {tool: 'answer', topic: 'lowest'} : {text: 'It bottoms out at {lowest_balance}.'}});
  assert.deepEqual(out.trace.map(t => [t.role, t.note]), [['Coordinator', 'Question about your lowest balance ahead'], ['Financial engine', 'Lowest balance ahead is $1,520.00 on Nov 7, $1,320.00 above your cushion'], ['Coach', 'Wrote the reply with verified figures']]);
});
