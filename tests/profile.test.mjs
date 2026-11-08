import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('profiles isolate snapshots and stale proposals cannot be approved with a newer version',async()=>{
 const child=spawn(process.execPath,['--experimental-sqlite','backend/server.mjs'],{env:{...process.env,PORT:'3099',DATABASE_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
 try{
  await once(child.stdout,'data');
  const call=async(path,method='GET',body,cookie)=>{const r=await fetch('http://127.0.0.1:3099/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const a=(await call('/demo-session','POST',{})).cookie,b=(await call('/demo-session','POST',{})).cookie;
  const proposal=(await call('/actions','POST',{amountCents:10000},a)).data;
  const p={cashFloorCents:25000,monthlyIncomeCents:300000,essentialMonthlyCents:100000,debtPaymentsCents:60000,goals:[{id:'home',name:'House',kind:'house',targetCents:1000000,savedCents:0,monthlyCents:30000}]};
  const updated=await call('/profile','PUT',p,a);assert.equal(updated.status,200);assert.equal(updated.data.metrics.find(m=>m.id==='debt-burden').value,0.2);
  const other=await call('/snapshot','GET',undefined,b);assert.equal(other.data.cashFloorCents,20000);assert.deepEqual(other.data.goals.map(g=>g.id),['example-emergency']);
  const refused=await call('/actions/'+proposal.id+'/approve','POST',{proposalHash:proposal.proposalHash,expectedGoalVersion:updated.data.goal.version,snapshotVersion:updated.data.version},a);
  assert.equal(refused.status,409);
  const scenario=await call('/scenarios','POST',{snapshotId:updated.data.id,snapshotVersion:updated.data.version,changes:[{kind:'extra_debt_payment',amountCents:30000,date:updated.data.asOf}]},a);
  assert.equal(scenario.data.scenario.policy,'blocked');assert.equal(scenario.data.scenario.goals[0].name,'House');
  const cleared=await call('/profile','PUT',{goals:[]},a);
  assert.equal(cleared.status,200);assert.equal(cleared.data.goal.amountCents,0);
  assert.equal(cleared.data.goal.version,updated.data.goal.version+1);
  assert.equal((await call('/actions','POST',{amountCents:100},a)).status,400);
 }finally{child.kill();await once(child,'exit');}
});
