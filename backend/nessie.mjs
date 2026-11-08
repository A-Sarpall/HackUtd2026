import {finalizeSnapshot,dollarsToCents,sumCents,integer} from './finance.mjs';

const base=(process.env.NESSIE_BASE_URL||'https://v2-prod-api.nessieisreal.com').replace(/\/$/,'');

async function request(path){
 if(!process.env.NESSIE_API_KEY)throw Object.assign(Error('NESSIE_KEY_MISSING'),{status:503});
 const response=await fetch(base+path,{headers:{Authorization:`Bearer ${process.env.NESSIE_API_KEY}`,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok){const error=Error(response.status===401||response.status===403?'NESSIE_AUTH_FAILED':response.status===429?'NESSIE_RATE_LIMITED':'NESSIE_UNAVAILABLE');error.status=response.status;throw error;}
 return response.json();
}

async function list(path){
 const items=[];let cursor='';
 do{const join=path.includes('?')?'&':'?';const page=await request(path+join+'limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));if(!Array.isArray(page.items))throw Error('NESSIE_INVALID_DATA');items.push(...page.items);cursor=page.next_cursor||'';}while(cursor&&items.length<1000);
 if(cursor)throw Error('NESSIE_DATA_LIMIT');return [...new Map(items.map(x=>[x.id,x])).values()];
}

export async function checkNessie(){const [customers,accounts]=await Promise.all([list('/customers'),list('/accounts')]);return {customers:customers.length,accounts:accounts.length};}

export async function listCustomers(){return (await list('/customers')).map((c,i)=>({id:c.id,label:`Sandbox customer ${i+1}`}));}
export async function loadNessieSnapshot(version=2,customerId){
 const [customers,accounts,bills,loans,transactions]=await Promise.all([list('/customers'),list('/accounts'),list('/bills'),list('/loans'),list('/transactions')]);
 if(!accounts.length){const error=Error('NESSIE_EMPTY');error.status=422;throw error;}
 const selectedCustomer=customerId?customers.find(c=>c.id===customerId):customers.length===1?customers[0]:null;
 if(!selectedCustomer)throw Error('CUSTOMER_REQUIRED');
 const selectedCustomerId=selectedCustomer.id;
 const ownedAccounts=accounts.filter(a=>a.customer_id===selectedCustomerId);
 if(!ownedAccounts.length){const error=Error('NESSIE_EMPTY');error.status=422;throw error;}
 const accountIds=new Set(ownedAccounts.map(a=>a.id));
 const ownedBills=bills.filter(b=>accountIds.has(b.account_id));
 const ownedLoans=loans.filter(l=>accountIds.has(l.account_id)&&l.status==='active');
 const ownedTransactions=transactions.filter(t=>accountIds.has(t.payer_id)||accountIds.has(t.payee_id));
 for(const a of ownedAccounts)if(!Number.isSafeInteger(a.balance_cents))throw Error('NESSIE_INVALID_DATA');
 const checking=ownedAccounts.filter(a=>a.type==='Checking');
 const savings=ownedAccounts.filter(a=>a.type==='Savings');
 const cards=ownedAccounts.filter(a=>a.type==='Credit Card');
 const openingCents=sumCents(checking.map(a=>a.balance_cents));
 const savingsCents=sumCents(savings.map(a=>a.balance_cents));
 const liabilitiesCents=sumCents([...cards.map(a=>Math.max(0,a.balance_cents)),...ownedLoans.map(l=>integer(l.amount_cents))]);
 const asOf=new Date().toISOString().slice(0,10);
 const horizon=new Date(asOf+'T12:00:00Z');horizon.setUTCDate(horizon.getUTCDate()+29);const end=horizon.toISOString().slice(0,10);
 const events=ownedBills.filter(b=>['pending','recurring'].includes(b.status)&&b.upcoming_payment_date>=asOf&&b.upcoming_payment_date<=end).map(b=>({id:b.id,date:b.upcoming_payment_date,cents:-dollarsToCents(b.payment_amount),label:b.nickname||b.payee,origin:'nessie'}));
 return finalizeSnapshot({id:`nessie-${asOf}`,version,asOf,quality:'partial',mode:'nessie_live',provider:{name:'Nessie v2',customers:customers.length,accounts:ownedAccounts.length,transactions:ownedTransactions.length,fetchedAt:new Date().toISOString()},openingCents,savingsCents,liabilitiesCents,cashFloorCents:20000,essentialMonthlyCents:null,accounts:ownedAccounts.map(a=>({id:a.id,type:a.type,name:a.nickname,balanceCents:a.balance_cents})),loans:ownedLoans.map(l=>({id:l.id,amountCents:l.amount_cents,monthlyPaymentCents:l.monthly_payment_cents,status:l.status})),transactions:ownedTransactions.map(t=>({id:t.id,date:t.created_at,status:t.status,amountCents:t.kind==='refund'?-integer(t.amount_cents):integer(t.amount_cents),category:t.kind==='transfer'&&accountIds.has(t.payer_id)&&accountIds.has(t.payee_id)?'transfer':t.kind==='refund'?'expense':accountIds.has(t.payer_id)?'expense':'income',kind:t.kind})),events,assumptions:['Nessie sandbox data for one test customer, not a real bank account.','The outlook includes upcoming sandbox bills only; expected income is not included.','Loan amounts come from the sandbox and may not match the balance still owed.','Emergency coverage and debt load use amounts you enter.','The safety cushion is a NextMove setting, not a bank limit.']});
}
