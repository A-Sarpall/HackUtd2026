import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../backend/finance.mjs';
import {enrich,alternatives,payoff,validateProfile} from '../backend/intelligence.mjs';
import {runDecision} from '../backend/agents.mjs';
test('unsafe payment produces a future safe alternative and goal tradeoff',()=>{
 const s=enrich(fixture(),{goals:[{id:'home',name:'House',targetCents:100000,savedCents:0,monthlyCents:10000}]});
 const options=alternatives(s,30000,s.asOf);
 assert.equal(options.requested.policy,'blocked');assert.equal(options.deferred.policy,'allowed');
 assert.equal(options.requested.goals[0].delayMonths,1);
 assert.equal(options.requested.unfundedCents,20000);
});
test('internal transfers are not income or spending and unknown essentials stay unknown',()=>{
 const s=enrich({...fixture(),essentialMonthlyCents:null,transactions:[{id:'a',date:'2026-11-06',status:'completed',category:'transfer',amountCents:90000}]});
 assert.equal(s.history.incomeCents,0);assert.equal(s.history.expenseCents,0);
 assert.equal(s.metrics.find(m=>m.id==='emergency-coverage').value,null);
});
test('loan payoff handles zero interest and non-amortizing loans',()=>{
 assert.deepEqual(payoff({principalCents:10000,paymentCents:1000,aprBps:0},2000),{months:8,interestCents:0});
 assert.equal(payoff({principalCents:100000,paymentCents:1,aprBps:1200},0).months,null);
 assert.throws(()=>validateProfile({goals:[],cashFloorCents:-1}));
});
test('three-role workflow checks model selection independently',async()=>{
 const s=enrich(fixture());
 const complete=async role=>role==='Coordinator'?{tool:'compare',amountCents:30000,date:s.asOf}:role==='Strategist'?{selected:'requested'}:{text:'Check the safer timing.'};
 await assert.rejects(()=>runDecision(s,{message:'Pay extra'},{complete}),/INVALID_MODEL_SELECTION/);
 const receipt=await runDecision(s,{message:'Pay extra'},{complete:async role=>role==='Strategist'?{selected:'deferred'}:complete(role)});
 assert.equal(receipt.selected,'deferred');assert.equal(receipt.trace.filter(t=>t.tool==='model').length,3);
});
