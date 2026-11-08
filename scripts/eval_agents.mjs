import assert from 'node:assert/strict';
import {fixture} from '../backend/finance.mjs';
import {enrich} from '../backend/intelligence.mjs';
import {runDecision} from '../backend/agents.mjs';

// Offline, synthetic cases exercise the host's guardrails, not model quality.
const cases = Array.from({length: 20}, (_, i) => ({
  opening: [10000, 20000, 50000, 120000, 250000][i % 5],
  income: i % 4 === 0 ? 0 : 300000,
  goal: i % 3 === 0,
  payment: [5000, 30000, 100000, 15000][i % 4],
}));
let passed = 0, selections = 0, rejected = 0, coachRejected = 0;
for (const c of cases) {
  const raw = {...fixture(), openingCents: c.opening};
  const goals = c.goal ? [{id:'house',kind:'house',name:'House',targetCents:1000000,savedCents:0,monthlyCents:10000,deadline:'2026-12-01'}] : [];
  const s = {...enrich(raw, {goals, monthlyIncomeCents:c.income}), goal:{version:1}};
  let offered;
  const responder = async (role, _prompt, data) => {
    if (role === 'Coordinator') return {tool:'compare',amountCents:c.payment,date:s.asOf};
    if (role === 'Strategist') { offered = data.allowed; return {selected: offered[0]}; }
    return {text:'Review the available option and the assumptions.'};
  };
  try {
    const result = await runDecision(s,{message:'Compare my payment'},{complete:responder});
    if (result.status === 'ready') { assert.ok(offered.includes(result.selected)); assert.equal(result.scenarios[result.selected].policy,'allowed'); selections++; }
    else assert.equal(result.status,'needs_information');
    passed++;
    if (offered) {
      await assert.rejects(runDecision(s,{message:'Compare my payment'},{complete:async (role,prompt,data)=>role==='Strategist'?{selected:'not_an_option'}:responder(role,prompt,data)}), /INVALID_MODEL_SELECTION/);
      rejected++;
      await assert.rejects(runDecision(s,{message:'Compare my payment'},{complete:async (role,prompt,data)=>role==='Coach'?{text:'Pay $999 now'}:responder(role,prompt,data)}), /INVALID_COACH_OUTPUT/);
      coachRejected++;
    }
  } catch (error) { console.error('Case failed:', error.message); }
}
console.log(`Offline host guardrails: ${passed}/${cases.length} (${(passed/cases.length*100).toFixed(0)}%)`);
console.log(`Allowed selections: ${selections}; invalid selections rejected: ${rejected}; numeric coach outputs rejected: ${coachRejected}`);
console.log('Synthetic scripted role outputs; this does not measure live Nemotron compliance or semantic correctness.');
if (passed !== cases.length || rejected !== selections || coachRejected !== selections) process.exitCode=1;
