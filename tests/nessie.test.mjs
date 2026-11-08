import {test} from 'node:test';
import assert from 'node:assert/strict';

test('Nessie mapping isolates one customer and produces a finance snapshot',async()=>{
 const originalFetch=globalThis.fetch, originalKey=process.env.NESSIE_API_KEY;
 process.env.NESSIE_API_KEY='test-key';
 const today=new Date().toISOString().slice(0,10), now=new Date().toISOString();
 const data={
  '/customers':[{id:'customer-a'},{id:'customer-b'}],
  '/accounts':[
   {id:'checking-a',customer_id:'customer-a',type:'Checking',balance_cents:125000},
   {id:'savings-a',customer_id:'customer-a',type:'Savings',balance_cents:50000},
   {id:'card-a',customer_id:'customer-a',type:'Credit Card',balance_cents:20000},
   {id:'checking-b',customer_id:'customer-b',type:'Checking',balance_cents:999999},
  ],
  '/bills':[
   {id:'bill-a',account_id:'checking-a',status:'pending',upcoming_payment_date:today,payment_amount:75,payee:'Power'},
   {id:'bill-b',account_id:'checking-b',status:'pending',upcoming_payment_date:today,payment_amount:900,payee:'Other'},
  ],
  '/loans':[{id:'loan-a',account_id:'card-a',amount_cents:30000},{id:'loan-b',account_id:'checking-b',amount_cents:800000}],
  '/transactions':[
   {id:'tx-a',payer_id:'checking-a',payee_id:'merchant',status:'completed',kind:'purchase',amount_cents:500,created_at:now},
   {id:'tx-b',payer_id:'checking-b',payee_id:'merchant',status:'completed',kind:'purchase',amount_cents:80000,created_at:now},
  ],
 };
 globalThis.fetch=async url=>{const path=new URL(url).pathname;return {ok:true,json:async()=>({items:data[path]||[]})};};
 try{
  const {loadNessieSnapshot}=await import('../backend/nessie.mjs?mapping-test');
  const snapshot=await loadNessieSnapshot(7);
  assert.equal(snapshot.mode,'nessie_live');
  assert.equal(snapshot.version,7);
  assert.equal(snapshot.openingCents,125000);
  assert.equal(snapshot.savingsCents,50000);
  assert.equal(snapshot.liabilitiesCents,50000);
  assert.equal(snapshot.essentialMonthlyCents,500);
  assert.equal(snapshot.provider.accounts,3);
  assert.equal(snapshot.provider.transactions,1);
  assert.deepEqual(snapshot.events.map(e=>e.id),['bill-a']);
  assert.equal(snapshot.forecast.dailyCash.length,30);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.NESSIE_API_KEY;else process.env.NESSIE_API_KEY=originalKey;
 }
});
