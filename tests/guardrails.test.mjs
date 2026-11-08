import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dollarsToCents,fixture,simulate,sumCents,goalImpact} from '../backend/finance.mjs';
import {enrich,payoff} from '../backend/intelligence.mjs';
import {runDecision} from '../backend/agents.mjs';

test('provider money conversion is exact and rejects missing or fractional cents',()=>{
 assert.equal(dollarsToCents('1000000000.29'),100000000029);
 assert.equal(dollarsToCents(1.01),101);
 for(const value of [null,undefined,'',NaN,'1.001','-1','1e3'])assert.throws(()=>dollarsToCents(value),/INVALID_AMOUNT/);
 assert.throws(()=>sumCents([Number.MAX_SAFE_INTEGER,1]),/INVALID_AMOUNT/);
 assert.throws(()=>simulate({...fixture(),events:[{date:'2026-11-07',cents:NaN}]}),/INVALID_AMOUNT/);
});
test('completed goal needs zero months even with no contribution; loan terms are validated',()=>{
 assert.deepEqual(goalImpact({name:'Home',targetCents:100,savedCents:100},0,0),{name:'Home',baselineMonths:0,proposedMonths:0});
 assert.throws(()=>payoff({principalCents:100,paymentCents:10,aprBps:null},0),/INVALID_AMOUNT/);
});
test('model output cannot smuggle operations or malformed clarification',async()=>{
 const s=enrich(fixture());
 for(const result of [{tool:'explain',execute:'approve'},{tool:'clarify',question:{text:'Hi'}}]){
  await assert.rejects(runDecision(s,{message:'Help'},{complete:async()=>result}),/INVALID_MODEL/);
 }
 const receipt=await runDecision(s,{message:'Help'},{complete:async role=>role==='Coordinator'?{tool:'explain'}:{text:'Review the listed assumptions.'}});
 assert.equal(receipt.provenance.mode,'test_provider');
 assert.equal(receipt.approvalRequired,false);
});
test('stalled provider stops at the workflow deadline without further calls',async()=>{
 const keepAlive=setInterval(()=>{},1000);let calls=0;
 try{await assert.rejects(runDecision(enrich(fixture()),{message:'Help'},{deadlineMs:20,complete:()=>{calls++;return new Promise(()=>{});}}),/WORKFLOW_DEADLINE/);assert.equal(calls,1);}finally{clearInterval(keepAlive);}
});
