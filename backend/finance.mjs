export const fixture = () => ({id:'demo-v1',version:1,asOf:'2026-11-07',quality:'complete',mode:'synthetic_fixture',openingCents:120000,savingsCents:60000,liabilitiesCents:200000,cashFloorCents:20000,essentialMonthlyCents:100000,events:[{id:'rent',date:'2026-11-10',cents:-90000},{id:'utility',date:'2026-11-11',cents:-10000},{id:'paycheck',date:'2026-11-14',cents:150000}],assumptions:['Synthetic demo data; only listed obligations included.','Savings are not automatically available for checking obligations.']});
export function integer(x){if(!Number.isSafeInteger(x)||x<0||x>1e12)throw Error('INVALID_AMOUNT');return x;}
function addDays(date, days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function simulate(s,changes=[]){
 if(!Array.isArray(changes)||changes.length>5)throw Error('INVALID_CHANGES');
 const events=[...s.events];
 for(const c of changes){if(c.kind!=='extra_debt_payment')throw Error('UNSUPPORTED_CHANGE');integer(c.amountCents);if(!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||new Date(c.date).toISOString().slice(0,10)!==c.date)throw Error('INVALID_DATE');if(c.date<s.asOf||c.date>addDays(s.asOf,29))throw Error('DATE_OUTSIDE_HORIZON');events.push({id:'scenario',date:c.date,cents:-c.amountCents});}
 let balance=s.openingCents;const dailyCash=[];let min=balance,minDate=s.asOf;
 for(let i=0;i<30;i++){const d=new Date(s.asOf+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);for(const e of events.filter(e=>e.date===date).sort((a,b)=>a.cents-b.cents)){balance+=e.cents;if(balance<min){min=balance;minDate=date;}}dailyCash.push({date,balanceCents:balance});}
 return {snapshotId:s.id,snapshotVersion:s.version,dailyCash,minCashCents:min,minCashDate:minDate,cashFloorCents:s.cashFloorCents,policy:min<s.cashFloorCents?'blocked':'allowed',evidenceIds:s.events.map(x=>x.id),assumptions:s.assumptions};
}
export function finalizeSnapshot(s){
 const forecast=simulate(s), coverage=s.essentialMonthlyCents>0?s.savingsCents/s.essentialMonthlyCents:null;
 const findings=[];
 if(forecast.minCashCents<s.cashFloorCents)findings.push({id:'buffer',severity:'critical',title:'Checking is projected below your cash floor',evidenceIds:forecast.evidenceIds});
 else if(forecast.minCashCents===s.cashFloorCents)findings.push({id:'buffer',severity:'warning',title:'Checking reaches your cash floor',evidenceIds:forecast.evidenceIds});
 if(coverage!=null&&coverage<1)findings.push({id:'coverage',severity:'warning',title:`Emergency savings cover ${coverage.toFixed(1)} months of listed essentials`,evidenceIds:['savings']});
 if(!s.events.length)findings.push({id:'coverage-data',severity:'info',title:'No upcoming obligations were returned by the connected bank',evidenceIds:[]});
 return {...s,forecast,metrics:[{id:'net-worth',value:s.openingCents+s.savingsCents-s.liabilitiesCents,unit:'cents'},{id:'emergency-coverage',value:coverage,unit:'months'},{id:'minimum-cash',value:forecast.minCashCents,unit:'cents'}],findings};
}
export function snapshot(){return finalizeSnapshot(fixture());}
