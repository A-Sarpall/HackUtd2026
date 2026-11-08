import {finalizeSnapshot} from './finance.mjs';

const base=(process.env.NESSIE_BASE_URL||'https://v2-prod-api.nessieisreal.com').replace(/\/$/,'');

async function request(path){
 if(!process.env.NESSIE_API_KEY)throw Object.assign(Error('NESSIE_KEY_MISSING'),{status:503});
 const response=await fetch(base+path,{headers:{Authorization:`Bearer ${process.env.NESSIE_API_KEY}`,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok){let detail='';try{detail=(await response.json()).detail||'';}catch{}const error=Error(response.status===401||response.status===403?'NESSIE_AUTH_FAILED':response.status===429?'NESSIE_RATE_LIMITED':'NESSIE_UNAVAILABLE');error.status=response.status;error.detail=detail;throw error;}
 return response.json();
}

async function list(path){
 const items=[];let cursor='';
 do{const join=path.includes('?')?'&':'?';const page=await request(path+join+'limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));items.push(...(page.items||[]));cursor=page.next_cursor||'';}while(cursor&&items.length<1000);
 return items;
}

export async function checkNessie(){const [customers,accounts]=await Promise.all([list('/customers'),list('/accounts')]);return {customers:customers.length,accounts:accounts.length};}

export async function loadNessieSnapshot(version=2){
 const [customers,accounts,bills,loans,transactions]=await Promise.all([list('/customers'),list('/accounts'),list('/bills'),list('/loans'),list('/transactions')]);
 if(!accounts.length){const error=Error('NESSIE_EMPTY');error.status=422;throw error;}
 const selectedCustomer=customers[0];
 const selectedCustomerId=selectedCustomer?.id||accounts[0].customer_id;
 const ownedAccounts=accounts.filter(a=>a.customer_id===selectedCustomerId);
 if(!ownedAccounts.length){const error=Error('NESSIE_EMPTY');error.status=422;throw error;}
 const accountIds=new Set(ownedAccounts.map(a=>a.id));
 const ownedBills=bills.filter(b=>accountIds.has(b.account_id));
 const ownedLoans=loans.filter(l=>accountIds.has(l.account_id));
 const ownedTransactions=transactions.filter(t=>accountIds.has(t.payer_id)||accountIds.has(t.payee_id));
 const checking=ownedAccounts.filter(a=>a.type==='Checking');
 const savings=ownedAccounts.filter(a=>a.type==='Savings');
 const cards=ownedAccounts.filter(a=>a.type==='Credit Card');
 const openingCents=checking.reduce((sum,a)=>sum+a.balance_cents,0);
 const savingsCents=savings.reduce((sum,a)=>sum+a.balance_cents,0);
 const liabilitiesCents=cards.reduce((sum,a)=>sum+Math.max(0,a.balance_cents),0)+ownedLoans.reduce((sum,l)=>sum+Math.max(0,l.amount_cents),0);
 const asOf=new Date().toISOString().slice(0,10);
 const horizon=new Date(asOf+'T12:00:00Z');horizon.setUTCDate(horizon.getUTCDate()+29);const end=horizon.toISOString().slice(0,10);
 const events=ownedBills.filter(b=>['pending','recurring'].includes(b.status)&&b.upcoming_payment_date>=asOf&&b.upcoming_payment_date<=end).map(b=>({id:b.id,date:b.upcoming_payment_date,cents:-Math.round(Number(b.payment_amount)*100),label:b.nickname||b.payee,origin:'nessie'}));
 const since=Date.now()-30*86400000;
 const essentials=ownedTransactions.filter(t=>t.status==='completed'&&accountIds.has(t.payer_id)&&['purchase','bill_payment','withdrawal','fee'].includes(t.kind)&&Date.parse(t.created_at)>=since).reduce((sum,t)=>sum+t.amount_cents,0);
 return finalizeSnapshot({id:`nessie-${asOf}`,version,asOf,quality:'complete',mode:'nessie_live',provider:{name:'Nessie v2',customers:customers.length,accounts:ownedAccounts.length,transactions:ownedTransactions.length,fetchedAt:new Date().toISOString()},openingCents,savingsCents,liabilitiesCents,cashFloorCents:20000,essentialMonthlyCents:essentials||null,events,assumptions:['Nessie v2 sandbox data for one customer; this is not a real bank connection.','Forecast includes upcoming Nessie bills only.','Cash floor is a NextMove demo preference.']});
}
