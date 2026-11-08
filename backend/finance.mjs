export const fixture = () => ({id:'demo-v1',version:1,asOf:'2026-11-07',quality:'complete',mode:'synthetic_fixture',openingCents:120000,savingsCents:60000,liabilitiesCents:200000,cashFloorCents:20000,essentialMonthlyCents:100000,events:[{id:'rent',date:'2026-11-10',cents:-90000},{id:'utility',date:'2026-11-11',cents:-10000},{id:'paycheck',date:'2026-11-14',cents:150000}],assumptions:['Made-up demo data. Only the bills and income listed are included.','Savings are not used to cover checking automatically.']});
// Koin's made-up demo customer. Rent, utilities, pay and habits are user-entered plan flows sent with the profile, so no bills are listed here.
export const koinDemo = () => ({id:'koin-demo-v1',version:1,asOf:'2026-11-07',quality:'complete',mode:'synthetic_fixture',openingCents:152000,savingsCents:60000,liabilitiesCents:200000,cashFloorCents:20000,essentialMonthlyCents:null,events:[],assumptions:['Made-up demo customer. Rent, utilities, pay and habits are the amounts entered in Koin.','Savings are not used to cover checking automatically.']});
export function integer(x){if(!Number.isSafeInteger(x)||x<0||x>1e12)throw Error('INVALID_AMOUNT');return x;}
function addDays(date, days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function simulate(s,changes=[]){
 if(!Array.isArray(changes)||changes.length>5)throw Error('INVALID_CHANGES');
 signedInteger(s.openingCents);integer(s.cashFloorCents);
 for(const event of s.events)signedInteger(event.cents);
 const events=[...s.events];
 for(const c of changes){if(c.kind!=='extra_debt_payment')throw Error('UNSUPPORTED_CHANGE');integer(c.amountCents);if(!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||new Date(c.date).toISOString().slice(0,10)!==c.date)throw Error('INVALID_DATE');if(c.date<s.asOf||c.date>addDays(s.asOf,29))throw Error('DATE_OUTSIDE_HORIZON');events.push({id:'scenario',date:c.date,cents:-c.amountCents});}
 let balance=s.openingCents;const dailyCash=[];let min=balance,minDate=s.asOf;
 for(let i=0;i<30;i++){const d=new Date(s.asOf+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);for(const e of events.filter(e=>e.date===date).sort((a,b)=>a.cents-b.cents)){balance=sumCents([balance,e.cents]);if(balance<min){min=balance;minDate=date;}}dailyCash.push({date,balanceCents:balance});}
 return {snapshotId:s.id,snapshotVersion:s.version,dailyCash,minCashCents:min,minCashDate:minDate,cashFloorCents:s.cashFloorCents,policy:min<s.cashFloorCents?'blocked':'allowed',evidenceIds:s.events.map(x=>x.id),assumptions:s.assumptions};
}
export function finalizeSnapshot(s){
 const forecast=simulate(s), coverage=s.essentialMonthlyCents>0?s.savingsCents/s.essentialMonthlyCents:null;
 const findings=[];
 if(forecast.minCashCents<s.cashFloorCents)findings.push({id:'buffer',severity:'critical',title:'Checking is projected to drop below your safety cushion',evidenceIds:forecast.evidenceIds});
 else if(forecast.minCashCents===s.cashFloorCents)findings.push({id:'buffer',severity:'warning',title:'Checking is projected to reach your safety cushion',evidenceIds:forecast.evidenceIds});
 if(coverage!=null&&coverage<1)findings.push({id:'coverage',severity:'warning',title:`Emergency savings cover about ${coverage.toFixed(1)} months of essential bills`,evidenceIds:['savings']});
 if(!s.events.length)findings.push({id:'coverage-data',severity:'info',title:'No upcoming bills were found, so the outlook may be incomplete',evidenceIds:[]});
 return {...s,forecast,metrics:[{id:'net-worth',value:sumCents([s.openingCents,s.savingsCents,-s.liabilitiesCents]),unit:'cents'},{id:'emergency-coverage',value:coverage,unit:'months'},{id:'minimum-cash',value:forecast.minCashCents,unit:'cents'}],findings};
}
export function snapshot(){return finalizeSnapshot(fixture());}

// Provider decimal dollars are parsed as digits, never multiplied as floats.
export function dollarsToCents(value){
 const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
 if(!match)throw Error('INVALID_AMOUNT');
 const cents=BigInt(match[1])*100n+BigInt((match[2]||'').padEnd(2,'0'));
 return integer(Number(cents));
}
export function signedInteger(value){if(!Number.isSafeInteger(value))throw Error('INVALID_AMOUNT');return value;}
export function sumCents(values){return values.reduce((total,value)=>signedInteger(total+signedInteger(value)),0);}
export function goalImpact(goal,oldAmount,newAmount){
 if(!goal)return null;
 const remaining=Math.max(0,integer(goal.targetCents)-integer(goal.savedCents));
 const months=amount=>remaining===0?0:integer(amount)>0?Math.ceil(remaining/amount):null;
 return {name:goal.name,baselineMonths:months(oldAmount),proposedMonths:months(newAmount)};
}

// ---- Action review support (all integer cents) ----
export {addDays};
// Formats verified cents for display and for agent placeholder substitution. Splits whole and fractional cents; no float math.
export function formatCents(cents){signedInteger(cents);const a=Math.abs(cents);return (cents<0?'−$':'$')+Math.floor(a/100).toLocaleString('en-US')+'.'+String(a%100).padStart(2,'0');}
export function monthsToReach(remainingCents,monthlyCents){integer(remainingCents);integer(monthlyCents);return remainingCents===0?0:monthlyCents>0?Math.ceil(remainingCents/monthlyCents):null;}
// Progress toward one goal at a given monthly amount. Months are 30 days; no investment returns.
export function goalProgress(goal,monthlyCents,asOf){
 if(!goal)return null;
 const target=integer(goal.targetCents),saved=integer(goal.savedCents),remaining=Math.max(0,target-saved),months=monthsToReach(remaining,monthlyCents);
 const reachDate=months==null?null:addDays(asOf,months*30);
 return {id:goal.id,name:goal.name,targetCents:target,savedCents:saved,remainingCents:remaining,percentSaved:target>0?Math.min(100,Math.floor(saved*100/target)):null,monthlyCents,months,reachDate,deadline:goal.deadline||null,onTrack:goal.deadline?reachDate!=null&&reachDate<=goal.deadline:null};
}
// Money left each month after declared essentials, debt payments and goal contributions. Unknown inputs make the result unknown.
// habitSpendingCents and routedMonthlyCents (freed-up cash the user sends to a goal) are optional: profiles that never set them have none to subtract.
export function monthlyLeftover({monthlyIncomeCents,essentialMonthlyCents,debtPaymentsCents,habitSpendingCents,routedMonthlyCents},goalsTotalCents){
 if([monthlyIncomeCents,essentialMonthlyCents,debtPaymentsCents].some(v=>v==null))return null;
 return sumCents([integer(monthlyIncomeCents),-integer(essentialMonthlyCents),-integer(debtPaymentsCents),-integer(habitSpendingCents??0),-integer(routedMonthlyCents??0),-integer(goalsTotalCents)]);
}
