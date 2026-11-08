// Creates an isolated local demo session. Nessie reads only; no bank writes.
import assert from 'node:assert/strict';
const base=process.env.NEXTMOVE_URL||'http://127.0.0.1:3003';
let cookie;
async function call(path,method='GET',body){
 const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 cookie??=r.headers.get('set-cookie')?.split(';')[0];
 const data=await r.json();if(!r.ok)throw Error(data.error?.code||'HTTP_'+r.status);return data;
}
await call('/demo-session','POST',{});
const {customers}=await call('/customers');assert.ok(customers.length);
await call('/sync','POST',{customerId:customers[0].id});
const s=await call('/profile','PUT',{
 cashFloorCents:220000,monthlyIncomeCents:400000,essentialMonthlyCents:200000,debtPaymentsCents:40000,
 loan:{principalCents:1200000,paymentCents:30000,aprBps:800},
 goals:[{id:'house',name:'Demo house goal',kind:'house',targetCents:2000000,savedCents:200000,monthlyCents:30000},{id:'emergency',name:'Demo emergency goal',kind:'emergency',targetCents:1200000,savedCents:1000000,monthlyCents:10000}]
});
const comparison=await call('/scenarios','POST',{snapshotId:s.id,snapshotVersion:s.version,changes:[{kind:'extra_debt_payment',amountCents:30000,date:s.asOf}]});
assert.equal(comparison.scenario.policy,'blocked');assert.equal(comparison.scenario.goals.length,2);
const run=await call('/runs','POST',{snapshotId:s.id,snapshotVersion:s.version,message:'Can I pay $300 extra toward my loan today while protecting my house goal?'});
assert.equal(run.status,'completed');assert.equal(run.receipt.status,'ready');
assert.equal(run.receipt.trace.filter(t=>t.tool==='model').length,3);
assert.equal(run.receipt.scenarios[run.receipt.selected].policy,'allowed');
const proposal=await call('/actions','POST',{amountCents:10000,receiptId:run.receipt.id});
const approval={proposalHash:proposal.proposalHash,expectedGoalVersion:proposal.expectedGoalVersion,snapshotVersion:proposal.snapshotVersion};
await call('/actions/'+proposal.id+'/approve','POST',approval);
await call('/actions/'+proposal.id+'/approve','POST',approval);
const final=await call('/snapshot');assert.equal(final.goal.amountCents,10000);assert.equal(final.goal.version,proposal.expectedGoalVersion+1);
const {receipts}=await call('/receipts');assert.equal(receipts[0].actionStatus,'completed');
console.log(JSON.stringify({ok:true,checks:['Nessie customer selection','declared profile and two goals','unsafe scenario rejected','three live Nemotron roles','allowed alternative','saved receipt','approved action recorded exactly once']}));
