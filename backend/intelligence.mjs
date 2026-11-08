import {simulate,integer,finalizeSnapshot,sumCents,addDays,formatCents,goalProgress,monthlyLeftover} from './finance.mjs';

export function validateProfile(p) {
  if(!p||typeof p!=='object'||Array.isArray(p))throw Error('INVALID_PROFILE');
  if(p.loan){for(const key of ['principalCents','paymentCents','aprBps'])integer(p.loan[key]);if(p.loan.aprBps>10000)throw Error('INVALID_APR');}
  for(const key of ['cashFloorCents','monthlyIncomeCents','essentialMonthlyCents','debtPaymentsCents']) {
    if(p[key]!=null) integer(p[key]);
  }
  if(!Array.isArray(p.goals)||p.goals.length>5) throw Error('INVALID_GOALS');
  const ids=new Set();
  for(const g of p.goals){
    if(typeof g.id!=='string'||ids.has(g.id)||!['house','emergency','other'].includes(g.kind)||typeof g.name!=='string'||g.name.length>80)throw Error('INVALID_GOALS');
    ids.add(g.id);
    for(const k of ['targetCents','savedCents','monthlyCents'])integer(g[k]);
    if(g.deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)||!Number.isFinite(Date.parse(g.deadline))||new Date(g.deadline).toISOString().slice(0,10)!==g.deadline))throw Error('INVALID_DATE');
  }
  return p;
}

export function enrich(raw,profile={goals:[]},planned=[]) {
  // Approved planned extra payments are app-plan events: they enter the forecast inside the 30-day horizon. No money moves.
  const horizonEnd=addDays(raw.asOf,29);
  const plannedEvents=planned.filter(p=>p.date>=raw.asOf&&p.date<=horizonEnd).map(p=>({id:'planned-'+p.id,date:p.date,cents:-integer(p.amountCents),label:'Planned extra payment',origin:'plan'}));
  const s=finalizeSnapshot({...raw,events:[...raw.events,...plannedEvents],
    loanTerms:profile.loan||null,
    cashFloorCents:profile.cashFloorCents??raw.cashFloorCents,
    essentialMonthlyCents:profile.essentialMonthlyCents??raw.essentialMonthlyCents,
    goals:profile.goals||[],
  });
  const tx=s.transactions||[], end=Date.parse(s.asOf+'T23:59:59Z');
  const recent=tx.filter(t=>t.status==='completed'&&Date.parse(t.date)<=end&&Date.parse(t.date)>end-30*86400000);
  const previous=tx.filter(t=>t.status==='completed'&&Date.parse(t.date)<=end-30*86400000&&Date.parse(t.date)>end-60*86400000);
  const total=(rows,kind)=>sumCents(rows.filter(t=>t.category===kind).map(t=>t.amountCents));
  const income=total(recent,'income'),expenses=total(recent,'expense');
  s.history={incomeCents:income,expenseCents:expenses,netCashFlowCents:sumCents([income,-expenses]),windowDays:30,recordCount:recent.length};
  const monthlyIncome=profile.monthlyIncomeCents??null;
  const payments=profile.debtPaymentsCents??null;
  s.metrics.push({id:'debt-burden',value:monthlyIncome>0&&payments!=null?payments/monthlyIncome:null,unit:'ratio',formula:'Monthly debt payments ÷ monthly take-home pay (both entered by you)'});
  s.metrics.forEach(m=>{m.formula??={'net-worth':'Checking + savings − listed debts','emergency-coverage':'Savings ÷ monthly essential bills (entered by you)','minimum-cash':'Lowest projected checking balance in the next 30 days'}[m.id];});
  const rules=[
    ['negative-cash',true,s.forecast.minCashCents<0,'critical','Checking is projected to go below zero',s.events.map(e=>e.id)],
    ['debt-burden',monthlyIncome>0&&payments!=null,payments/monthlyIncome>0.4,'warning','Debt payments you entered are more than 40% of your take-home pay',[]],
    ['spending-rise',recent.length>0&&previous.length>0,total(previous,'expense')>0&&expenses>total(previous,'expense')*1.25,'warning','Spending in the last 30 days is more than 25% higher than the 30 days before',recent.filter(t=>t.category==='expense').map(t=>t.id)],
    ['stale-feed',!!s.provider?.fetchedAt,Date.now()-Date.parse(s.provider?.fetchedAt)>86400000,'warning','Sandbox data is more than a day old; balances may be out of date',[]],
    ['essential-data',true,s.essentialMonthlyCents==null,'info','Add your monthly essential bills to calculate emergency savings coverage',[]],
  ];
  s.detectorCoverage=rules.map(([id,ready,hit])=>({id,status:!ready?'insufficient_data':hit?'flagged':'clear'}));
  for(const [id,ready,hit,severity,title,evidenceIds] of rules)if(ready&&hit)s.findings.push({id,severity,title,evidenceIds});
  for(const g of s.goals){const remaining=Math.max(0,g.targetCents-g.savedCents),months=g.monthlyCents>0?Math.ceil(remaining/g.monthlyCents):remaining===0?0:null;
    if(g.deadline&&(months===null||Date.parse(s.asOf)+months*30*86400000>Date.parse(g.deadline)))s.findings.push({id:'goal-'+g.id,severity:'warning',title:g.name+' is not on track to reach its target by the date you set',evidenceIds:[]});}
  s.assumptions=[...s.assumptions,'Goal timelines assume your monthly amounts stay the same and count a month as 30 days. No money is set aside or moved.'];
  const plannedCents=sumCents(planned.map(p=>integer(p.amountCents)));
  const debtBase=s.loanTerms?integer(s.loanTerms.principalCents):integer(s.liabilitiesCents);
  s.plannedPayments=planned.map(p=>({id:p.id,amountCents:p.amountCents,date:p.date}));
  s.debt={label:s.loanTerms?'loan balance':'total owed',baseCents:debtBase,plannedCents,currentCents:Math.max(0,debtBase-plannedCents)};
  const goalsTotal=sumCents(s.goals.map(g=>integer(g.monthlyCents)));
  s.budget={leftoverCents:monthlyLeftover(profile,goalsTotal),goalsTotalCents:goalsTotal};
  s.goalProgress=goalProgress(s.goals[0],s.goals[0]?.monthlyCents??0,s.asOf);
  if(planned.length)s.assumptions=[...s.assumptions,'Planned extra payments are in your NextMove plan only. NextMove does not send them; pay your lender directly.'];
  return s;
}

export function compare(s,amountCents,date){
  integer(amountCents);
  const scenario=simulate(s,[{kind:'extra_debt_payment',amountCents,date}]);
  const baseline=simulate(s);
  const available=Math.max(0,baseline.minCashCents-s.cashFloorCents);
  const diverted=Math.max(0,amountCents-available);
  let budget=diverted;
  const goals=(s.goals||[]).map(g=>{
    const remaining=Math.max(0,g.targetCents-g.savedCents);
    const reduction=Math.min(budget,g.monthlyCents,remaining);budget-=reduction;
    const months=g.monthlyCents>0?Math.ceil(remaining/g.monthlyCents):remaining?null:0;
    const changed=g.monthlyCents>0?Math.ceil((remaining+reduction)/g.monthlyCents):remaining?null:0;
    return {id:g.id,name:g.name,baselineMonths:months,scenarioMonths:changed,delayMonths:months==null||changed==null?null:changed-months,oneMonthContributionReductionCents:reduction};
  });
  const planned=s.debt?.plannedCents??0;
  const before=s.loanTerms?payoff(s.loanTerms,planned):null,after=s.loanTerms?payoff(s.loanTerms,sumCents([planned,amountCents])):null;
  const debtBefore=s.debt?.currentCents??null;
  return {...scenario,amountCents,date,goals,debtLabel:s.debt?.label??null,debtBeforeCents:debtBefore,debtAfterCents:debtBefore==null?null:Math.max(0,debtBefore-amountCents),payoffMonthsBefore:before?.months??null,debtPrincipalReductionCents:s.loanTerms?Math.min(amountCents,Math.max(0,s.loanTerms.principalCents-planned)):null,payoffMonths:after?.months??null,monthsSaved:before?.months!=null&&after?.months!=null?before.months-after.months:null,interestSavingsCents:before?.interestCents!=null&&after?.interestCents!=null?before.interestCents-after.interestCents:null,
    emergencyCoverageMonths:s.essentialMonthlyCents>0?s.savingsCents/s.essentialMonthlyCents:null,
    goalConflict:goals.some(g=>g.oneMonthContributionReductionCents>0),unfundedCents:budget,
    assumptions:[...s.assumptions,'The extra payment comes out of checking; savings are not touched.','If a payment would drop checking below your cushion, goal effects assume you set aside less for one month to cover the gap, in goal order. This is hypothetical and does not change the cash outlook.','Loan estimates assume the extra payment is applied right away, the rate and monthly payment stay the same, interest is rounded to the cent each month, and there are no fees. Without all loan details, payoff is shown as unknown.']};
}

export function payoff(terms,extra){
 integer(extra);for(const key of ['principalCents','paymentCents','aprBps'])integer(terms[key]);if(terms.aprBps>10000)throw Error('INVALID_APR');let principal=Math.max(0,terms.principalCents-extra),interestCents=0,months=0;
 while(principal>0&&months<600){const interest=Number((BigInt(principal)*BigInt(terms.aprBps)+60000n)/120000n);if(terms.paymentCents<=interest)return {months:null,interestCents:null};interestCents=sumCents([interestCents,interest]);principal=Math.max(0,sumCents([principal,interest,-terms.paymentCents]));months++;}
 return principal?{months:null,interestCents:null}:{months,interestCents};
}

export function alternatives(s,amountCents,date){
  const choices={baseline:compare(s,0,s.asOf),requested:compare(s,amountCents,date)};
  if(choices.requested.policy==='blocked'){
    const cap=Math.max(0,choices.baseline.minCashCents-s.cashFloorCents);
    if(cap>0)choices.smaller=compare(s,Math.min(amountCents,cap),date);
    for(const d of choices.baseline.dailyCash.map(x=>x.date).filter(d=>d>date)){
      const option=compare(s,amountCents,d);
      if(option.policy==='allowed'){choices.deferred=option;break;}
    }
  }
  return choices;
}


// ---- Verified facts for reviewing an action before approval ----
const shortDate=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):null;
const monthYear=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}):null;
const monthsText=n=>n==null?null:n+(n===1?' month':' months');
const coverageText=s=>s.essentialMonthlyCents>0?`about ${(s.savingsCents/s.essentialMonthlyCents).toFixed(1)} months`:null;
const m=c=>c==null?null:formatCents(c);

// Returns policy, allowed alternatives, warning codes, and display-ready facts keyed by placeholder name.
export function reviewFacts(s,action){
  if(action?.kind==='debt_payment'){
    integer(action.amountCents);if(action.amountCents<1)throw Error('INVALID_AMOUNT');
    if(action.amountCents>s.debt.currentCents)throw Error('PAYMENT_EXCEEDS_DEBT');
    const o=alternatives(s,action.amountCents,action.date),r=o.requested,base=o.baseline;
    const pick=x=>x&&{amountCents:x.amountCents,date:x.date,policy:x.policy,minCashCents:x.minCashCents,minCashDate:x.minCashDate};
    const options={requested:pick(r),...(o.smaller?{smaller:pick(o.smaller)}:{}),...(o.deferred?{deferred:pick(o.deferred)}:{})};
    const blocked=r.policy==='blocked',margin=r.minCashCents-s.cashFloorCents;
    const warnings=[blocked&&'below_cushion',!blocked&&margin<s.cashFloorCents&&'thin_margin',s.essentialMonthlyCents>0&&s.savingsCents<s.essentialMonthlyCents&&'low_emergency_savings',!s.loanTerms&&'loan_terms_missing',blocked&&r.goalConflict&&'goal_contributions_affected'].filter(Boolean);
    const facts={amount:m(action.amountCents),date:shortDate(action.date),checking_today:m(s.openingCents),lowest_balance:m(r.minCashCents),lowest_date:shortDate(r.minCashDate),lowest_without_payment:m(base.minCashCents),cushion:m(s.cashFloorCents),
      shortfall:blocked?m(s.cashFloorCents-r.minCashCents):null,margin_above_cushion:blocked?null:m(margin),debt_label:r.debtLabel,debt_before:m(r.debtBeforeCents),debt_after:m(r.debtAfterCents),
      interest_saved:r.interestSavingsCents==null?null:m(r.interestSavingsCents),months_saved:monthsText(r.monthsSaved),payoff_time:monthsText(r.payoffMonths),emergency_coverage:coverageText(s),
      smaller_amount:m(o.smaller?.amountCents),smaller_date:shortDate(o.smaller?.date),later_amount:m(o.deferred?.amountCents),later_date:shortDate(o.deferred?.date)};
    return {kind:'debt_payment',policy:r.policy,options,warnings,facts,comparison:{minCashCents:r.minCashCents,minCashDate:r.minCashDate,baselineMinCashCents:base.minCashCents,debtLabel:r.debtLabel,debtBeforeCents:r.debtBeforeCents,debtAfterCents:r.debtAfterCents,interestSavingsCents:r.interestSavingsCents,monthsSaved:r.monthsSaved,payoffMonths:r.payoffMonths,payoffMonthsBefore:r.payoffMonthsBefore}};
  }
  if(action?.kind==='goal_contribution'){
    const g=s.goals[0];if(!g)throw Error('NO_GOAL');integer(action.amountCents);
    const current=integer(g.monthlyCents),next=action.amountCents,change=next-current;
    const now=goalProgress(g,current,s.asOf),after=goalProgress(g,next,s.asOf);
    const leftoverNow=s.budget.leftoverCents,leftoverNew=leftoverNow==null?null:sumCents([leftoverNow,-change]);
    const blocked=change>0&&leftoverNew!=null&&leftoverNew<0;
    const maxAffordable=leftoverNow==null?null:current+Math.max(0,leftoverNow);
    const options={requested:{amountCents:next,policy:blocked?'blocked':'allowed'},...(blocked&&maxAffordable>current?{smaller:{amountCents:maxAffordable,policy:'allowed'}}:{})};
    const warnings=[blocked&&'over_budget',change>0&&leftoverNow==null&&'budget_unknown',after.deadline&&after.onTrack===false&&'behind_deadline',change<0&&'reduction_delays_goal',s.essentialMonthlyCents>0&&s.savingsCents<s.essentialMonthlyCents&&'low_emergency_savings'].filter(Boolean);
    const facts={goal_name:g.name,current_amount:m(current),new_amount:m(next),change:m(Math.abs(change)),target:m(now.targetCents),saved:m(now.savedCents),remaining:m(now.remainingCents),percent_saved:now.percentSaved==null?null:now.percentSaved+'%',
      months_now:monthsText(now.months),months_new:monthsText(after.months),reach_now:monthYear(now.reachDate),reach_new:monthYear(after.reachDate),deadline:monthYear(after.deadline),
      leftover_now:m(leftoverNow),leftover_new:m(leftoverNew),max_affordable:m(maxAffordable),emergency_coverage:coverageText(s),smaller_amount:options.smaller?m(options.smaller.amountCents):null};
    return {kind:'goal_contribution',policy:blocked?'blocked':'allowed',options,warnings,facts,progressNow:now,progressNew:after,leftoverNowCents:leftoverNow,leftoverNewCents:leftoverNew};
  }
  throw Error('UNSUPPORTED_ACTION');
}

// Fills {placeholder} tokens with verified facts. Rejects unknown or empty placeholders and any raw numbers outside them.
export function fillPlaceholders(text,facts){
  if(typeof text!=='string'||!text.trim()||text.length>900)throw Error('INVALID_REVIEW_TEXT');
  const bare=text.replace(/\{([a-z_]+)\}/g,'');
  if(/[0-9$%{}]/.test(bare))throw Error('UNVERIFIED_NUMBER');
  return text.replace(/\{([a-z_]+)\}/g,(_,k)=>{if(facts[k]==null)throw Error('UNKNOWN_PLACEHOLDER');return facts[k];});
}
