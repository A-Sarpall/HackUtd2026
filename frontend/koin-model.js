/* Koin shared prototype model: demo data, finance math, goals, Kip mascot, view builder. */
(function () {
'use strict';
const TODAY = '2026-11-07';
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const D = s => new Date(s + 'T12:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const addMonths = (s, n) => { const d = D(s); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
const between = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const fDay = s => { const d = D(s); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
const fMonth = s => { const d = D(s); return MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const money = v => { const r = Math.round(v); return (r < 0 ? '−' : '') + '$' + Math.abs(r).toLocaleString('en-US'); };
const smoney = v => { const r = Math.round(v); return (r < 0 ? '−' : '+') + '$' + Math.abs(r).toLocaleString('en-US'); };
const kmoney = v => Math.abs(v) >= 10000 ? (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v) / 1000) + 'k' : money(v);
const fmtDur = mo => { if (mo === null || mo === undefined || !isFinite(mo)) return '—'; const days = Math.round(mo * 30); const X = Math.floor(days / 30), Yd = days % 30;
  const ms = X + (X === 1 ? ' month' : ' months'), ds = Yd + (Yd === 1 ? ' day' : ' days'); return X === 0 ? ds : Yd === 0 ? ms : ms + ' and ' + ds; };
const T = n => 'var(--' + n + ')';

const LEVERS = [
  { id: 'dining', label: 'Dining out', base: 280, min: 0, max: 500, step: 10, kind: 'spend' },
  { id: 'groceries', label: 'Groceries', base: 360, min: 150, max: 600, step: 10, kind: 'spend' },
  { id: 'coffee', label: 'Coffee', base: 72, min: 0, max: 150, step: 2, kind: 'spend' },
  { id: 'rides', label: 'Rideshare & gas', base: 140, min: 0, max: 300, step: 5, kind: 'spend' },
  { id: 'shopping', label: 'Shopping', base: 210, min: 0, max: 500, step: 10, kind: 'spend' },
  { id: 'subs', label: 'Subscriptions', base: 64, min: 0, max: 150, step: 1, kind: 'spend' },
  { id: 'side', label: 'Side income', base: 0, min: 0, max: 1000, step: 25, kind: 'income' },
  { id: 'extraDebt', label: 'Extra card payment', base: 0, min: 0, max: 500, step: 10, kind: 'plan' },
  { id: 'goal', label: 'Emergency fund', base: 300, min: 0, max: 800, step: 10, kind: 'plan' },
];
const BASE = Object.fromEntries(LEVERS.map(l => [l.id, l.base]));
const DISC = ['dining', 'groceries', 'coffee', 'rides', 'shopping'];
const PROFILE = { checking: 1520, savings: 600, owe: 2000, apr: 24, minPay: 60, income: 3000, rent: 900, utilities: 100, cushion: 200, goalName: 'Emergency fund', goalTarget: 3000 };
const TYPES = {
  emergency: { kind: 'save', name: 'Emergency fund', label: 'Safety net', c: 'g1' },
  vacation: { kind: 'save', name: 'Vacation fund', label: 'Vacation', c: 'g2' },
  house: { kind: 'save', name: 'Home down payment', label: 'Down payment', c: 'g3' },
  car: { kind: 'save', name: 'New car fund', label: 'Car', c: 'g3' },
  wedding: { kind: 'save', name: 'Wedding fund', label: 'Wedding', c: 'g2' },
  education: { kind: 'save', name: 'Education fund', label: 'Education', c: 'g5' },
  other_save: { kind: 'save', name: 'Savings goal', label: 'Savings', c: 'g1' },
  credit_card: { kind: 'payoff', name: 'Credit card', label: 'Credit card', c: 'g6', apr: 24, years: 3 },
  mortgage: { kind: 'payoff', name: 'Mortgage', label: 'Mortgage', c: 'g4', apr: 6.5, years: 30 },
  student_loan: { kind: 'payoff', name: 'Student loans', label: 'Student loans', c: 'g5', apr: 5.5, years: 10 },
  car_loan: { kind: 'payoff', name: 'Car loan', label: 'Car loan', c: 'g3', apr: 7, years: 5 },
  personal_loan: { kind: 'payoff', name: 'Personal loan', label: 'Loan', c: 'g6', apr: 12, years: 3 },
  other_debt: { kind: 'payoff', name: 'Loan', label: 'Loan', c: 'g6', apr: 8, years: 5 },
};
const GOALS0 = [{ id: 'emergency', type: 'emergency', kind: 'save', fixed: true }, { id: 'card', type: 'credit_card', kind: 'payoff', fixed: true }];
const PAY_DATES = [
  { date: '2026-11-07', label: 'Today', sub: 'Nov 7' },
  { date: '2026-11-14', label: 'Payday', sub: 'Nov 14' },
  { date: '2026-11-15', label: 'Day after', sub: 'Nov 15' },
];
const PAST = [{ date: '2026-10-31', label: 'Payday', amt: 1500 }, { date: '2026-11-03', label: 'Subscriptions', amt: -64 }, { date: '2026-11-04', label: 'Car repair', amt: -412 }];
const amort = (P, apr, n) => { const r = apr / 1200; return r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n)); };

function payoff(owe, apr, pay) {
  const r = apr / 1200; let b = owe, k = 0, int = 0;
  if (b <= 0.005) return { months: 0, interest: 0 };
  while (b > 0.005 && k < 720) { const i = b * r; if (pay <= i + 0.005) return { months: null, interest: null }; int += i; b = b + i - pay; k++; }
  return { months: k, interest: int };
}
function resolveGoals(goals, P) {
  return goals.map(g => {
    if (g.id === 'emergency') return Object.assign({}, g, { name: P.goalName, target: P.goalTarget, saved: P.savings });
    if (g.id === 'card') return Object.assign({}, g, { name: 'Credit card', balance: P.owe, apr: P.apr, minPay: P.minPay });
    return g;
  });
}
const goalMonthly = (g, lv, usePlan) => g.id === 'emergency' ? lv.goal : g.id === 'card' ? g.minPay + lv.extraDebt : usePlan ? g.planMonthly : g.monthly;

function history(P, lv) {
  const spend = DISC.reduce((a, k) => a + BASE[k], 0) / 30; const out = []; let cur = P.checking;
  for (let i = 1; i <= 10; i++) {
    const date = addDays(TODAY, -i); const ev = PAST.filter(p => p.date === date).map(p => p.label === 'Subscriptions' ? Object.assign({}, p, { amt: -(lv ? lv.subs : BASE.subs) }) : p).filter(p => Math.abs(p.amt) >= 0.5);
    out.unshift({ date, bal: cur, low: cur, ev: ev.map(e => ({ k: e.amt > 0 ? 'pay' : 'bill', label: e.label, amt: e.amt })) });
    cur = cur + spend - ev.reduce((a, e) => a + e.amt, 0);
  }
  return out;
}

function goalResults(gs, extras) {
  return gs.map(x => {
    const g = x.g;
    if (g.kind === 'save') { const rem = g.target - g.saved; const months = rem <= 0 ? 0 : x.m > 0 ? rem / x.m : null;
      return { id: g.id, months, date: months === null ? null : addDays(TODAY, Math.round(months * 30)), interest: 0 }; }
    const owe = Math.max(0, g.balance - (g.id === 'card' ? extras.reduce((a, e) => a + e.amount, 0) : 0));
    const po = payoff(owe, g.apr, x.m);
    return { id: g.id, months: po.months, date: po.months === null ? null : po.months === 0 ? TODAY : addMonths('2026-11-20', po.months - 1), interest: po.interest, owe };
  });
}

function compute(lv, P, goalsIn, route, extras, usePlan, horizonMonths) {
  extras = extras || [];
  const goals = resolveGoals(goalsIn, P);
  const disc = DISC.reduce((a, k) => a + lv[k], 0);
  const freed = DISC.reduce((a, k) => a + BASE[k] - lv[k], 0) + (BASE.subs - lv.subs) + lv.side;
  const pos = Math.max(0, freed);
  const gs = goals.map(g => { const mb = Math.max(0, goalMonthly(g, lv, usePlan)); return { g, mBase: mb, m: mb + (route === g.id ? pos : 0), bal: g.kind === 'payoff' ? g.balance : 0, saved: g.kind === 'save' ? g.saved : 0 }; });
  const hasMortgage = goals.some(g => g.type === 'mortgage');
  const rent = hasMortgage ? 0 : P.rent;
  const card = gs.find(x => x.g.id === 'card');
  let bal = P.checking; const days = [];
  for (let i = 0; i < 30; i++) {
    const date = addDays(TODAY, i), dom = D(date).getUTCDate(); const ev = [];
    if (dom === 10 && rent > 0) ev.push({ k: 'bill', label: 'Rent', amt: -rent });
    if (dom === 11) ev.push({ k: 'bill', label: 'Utilities', amt: -P.utilities });
    if (dom === 3 && lv.subs > 0) ev.push({ k: 'bill', label: 'Subscriptions', amt: -lv.subs });
    if (dom === 15) gs.forEach(x => { if (x.g.kind === 'save' && x.mBase > 0 && x.saved < x.g.target) { const c = Math.min(x.mBase, x.g.target - x.saved); x.saved += c; ev.push({ k: 'goal', label: 'To ' + x.g.name.toLowerCase(), amt: -c }); } });
    if (dom === 20) gs.forEach(x => { if (x.g.kind === 'payoff' && x.bal > 0.005 && x.mBase > 0) { const it = x.bal * x.g.apr / 1200; const p = Math.min(x.mBase, x.bal + it); x.bal = x.bal + it - p; ev.push({ k: 'debt', label: x.g.name + ' payment', amt: -p }); } });
    for (const e of extras) if (e.date === date) { if (card) card.bal = Math.max(0, card.bal - e.amount); ev.push({ k: 'extra', label: e.preview ? 'Extra payment (preview)' : 'Extra payment', amt: -e.amount }); }
    const outs = ev.filter(e => e.amt < 0).reduce((a, e) => a + e.amt, 0);
    bal += -disc / 30 + outs;
    const low = bal;
    if (dom === 14 || dom === 28) ev.push({ k: 'pay', label: 'Payday', amt: P.income / 2 });
    bal += lv.side / 30 + (dom === 14 || dom === 28 ? P.income / 2 : 0);
    days.push({ date, bal, low, ev });
  }
  let lowest = Infinity, li = 0; days.forEach((d, i) => { if (d.low < lowest) { lowest = d.low; li = i; } });
  const nwOf = (b) => b + gs.filter(x => x.g.kind === 'save').reduce((a, x) => a + x.saved, 0) - gs.filter(x => x.g.kind === 'payoff' && x.g.type !== 'mortgage').reduce((a, x) => a + x.bal, 0);
  const d29 = days[29].date; const nw29 = nwOf(bal);
  const months = []; const H = horizonMonths || 11;
  for (let m = 1; m <= H; m++) {
    bal += P.income + lv.side - rent - P.utilities - lv.subs - disc;
    gs.forEach(x => {
      if (x.g.kind === 'save' && x.m > 0 && x.saved < x.g.target) { const c = Math.min(x.m, x.g.target - x.saved); x.saved += c; bal -= c; }
      if (x.g.kind === 'payoff' && x.bal > 0.005 && x.m > 0) { const it = x.bal * x.g.apr / 1200; const p = Math.min(x.m, x.bal + it); x.bal = x.bal + it - p; bal -= p; }
    });
    months.push({ date: addMonths(d29, m), bal, nw: nwOf(bal), sav: gs.filter(x => x.g.kind === 'save').reduce((a, x) => a + x.saved, 0) });
  }
  const gs0 = goals.map(g => ({ g, m: Math.max(0, goalMonthly(g, lv, usePlan)) + (route === g.id ? pos : 0) }));
  const res = goalResults(gs0, extras);
  const goalMap = Object.fromEntries(res.map(r => [r.id, r]));
  const essentials = rent + P.utilities;
  const committed = gs0.reduce((a, x) => a + x.m, 0);
  const leftover = P.income + lv.side - essentials - lv.subs - disc - committed;
  const emerg = gs0.find(x => x.g.id === 'emergency');
  const em = goalMap.emergency || { months: null, date: null }, cd = goalMap.card || { months: null, date: null, interest: null, owe: 0 };
  const savings = goals.filter(g => g.kind === 'save').reduce((a, g) => a + g.saved, 0);
  const debts = goals.filter(g => g.kind === 'payoff' && g.type !== 'mortgage').reduce((a, g) => a + g.balance, 0) - extras.reduce((a, e) => a + e.amount, 0);
  const gap = lowest - P.cushion;
  const payoffs = res.filter(r => goals.find(g => g.id === r.id).kind === 'payoff');
  const debtFree = payoffs.some(r => r.months === null) ? null : payoffs.reduce((a, r) => r.date && (!a || r.date > a) ? r.date : a, null);
  const debtFreeMonths = payoffs.some(r => r.months === null) ? null : Math.max.apply(null, payoffs.map(r => r.months).concat([0]));
  const m12 = months[Math.min(10, months.length - 1)];
  let mood = lowest < 0 || leftover < -50 ? 'panic' : gap < 0 ? 'worried' : gap < 100 || leftover < 0 ? 'nervous' : 'happy';
  if (mood === 'happy' && ((em.months !== null && em.months <= 6 && cd.months !== null && cd.months <= 24) || (gap >= 400 && leftover >= 600))) mood = 'thriving';
  return { goals, gs: gs0, res, goalMap, disc, freed, effGoal: emerg ? emerg.m : 0, effExtra: card ? (gs0.find(x => x.g.id === 'card').m - P.minPay) : 0, days, lowest, lowestDate: days[li].date, li, gap, months, nw29,
    owe: cd.owe || 0, debtMonths: cd.months, interest: cd.interest, debtDate: cd.date, goalMonths: em.months, goalDate: em.date, leftover, essentials, rent, hasMortgage, debtFree, debtFreeMonths,
    nwNow: P.checking + savings - debts, nw12: m12.nw, sav12: m12.sav, cov: P.savings / essentials, cov12: (P.savings + Math.min(P.goalTarget - P.savings, (emerg ? emerg.m : 0) * 11.5)) / essentials, mood };
}
function horizonFor(results) {
  let mx = 0; results.forEach(r => r.res.forEach(x => { if (x.months !== null && x.months > mx) mx = x.months; }));
  const yrs = Math.min(30, Math.max(5, Math.ceil((mx + 1) / 12)));
  return yrs;
}

/* ---------- Kip the koi ---------- */
const MOOD = {
  thriving: { label: 'thriving', wag: .36, body: 'koinHop 2.4s ease-in-out infinite' },
  happy: { label: 'happy', wag: .6, body: 'koinBob 2.6s ease-in-out infinite' },
  nervous: { label: 'a little nervous', wag: .85, body: 'koinBob 1.8s ease-in-out infinite' },
  worried: { label: 'worried', wag: 1.1, body: 'koinBob 1.4s ease-in-out infinite' },
  panic: { label: 'panicking', wag: .2, body: 'koinShake .32s linear infinite' },
};
function kip(React, o) {
  const h = React.createElement; const mood = o.mood || 'happy'; const M = MOOD[mood]; const size = o.size || 72;
  const ln = 'var(--kip-line)', body = 'var(--kip-body)', patch = 'var(--kip-patch)', fin = 'var(--kip-fin)';
  const st = { stroke: ln, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };
  const mouth = mood === 'panic' ? h('ellipse', { cx: 109, cy: 43, rx: 2.4, ry: 3, fill: ln })
    : mood === 'worried' ? h('path', { d: 'M105 44 Q108.5 40.5 112 44', fill: 'none', ...st, strokeWidth: 2.4 })
    : mood === 'nervous' ? h('path', { d: 'M105 43 L111 42', fill: 'none', ...st, strokeWidth: 2.4 })
    : h('path', { d: 'M104.5 41 Q108 45.5 112 41', fill: 'none', ...st, strokeWidth: 2.4 });
  const anxious = mood === 'worried' || mood === 'panic';
  const happy = mood === 'happy' || mood === 'thriving';
  const svg = h('svg', { viewBox: '0 0 124 72', width: size, height: size * 72 / 124, style: { overflow: 'visible', display: 'block', animation: o.still ? 'none' : M.body } },
    h('g', { style: { transformBox: 'fill-box', transformOrigin: '100% 50%', animation: o.still ? 'none' : 'koinWag ' + M.wag + 's ease-in-out infinite alternate' } },
      h('path', { d: 'M36 36 C26 27 16 15 5 12 C10 24 11 30 9 36 C11 42 10 48 5 60 C16 57 26 45 36 36 Z', fill: fin, ...st })),
    h('path', { d: 'M54 18 C59 7 72 5 81 15', fill: fin, ...st }),
    h('path', { d: 'M31 36 C37 18 62 12 84 15 C103 17 115 26 115 36 C115 46 103 55 84 57 C62 60 37 54 31 36 Z', fill: body, ...st }),
    h('path', { d: 'M50 23 C60 15 77 14 87 19 C82 30 65 35 52 31 C49 29 48 26 50 23 Z', fill: patch }),
    h('path', { d: 'M37 38 C40 31 47 30 52 35 C49 43 42 46 37 38 Z', fill: patch }),
    h('circle', { cx: 97, cy: 23.5, r: 5.5, fill: patch }),
    h('g', { style: { transformBox: 'fill-box', transformOrigin: '0% 0%', animation: o.still ? 'none' : 'koinFin 1.2s ease-in-out infinite alternate' } },
      h('path', { d: 'M71 51 C69 61 61 67 54 65 C58 59 62 53 71 51 Z', fill: fin, ...st })),
    happy ? h('ellipse', { cx: 91, cy: 42.5, rx: 4.8, ry: 2.8, fill: 'var(--kip-blush)' }) : null,
    h('g', { style: { transformBox: 'fill-box', transformOrigin: '50% 50%', animation: o.still ? 'none' : 'koinBlink 4.6s infinite' } },
      h('circle', { cx: 98, cy: 33, r: 4.4, fill: ln }), h('circle', { cx: 99.6, cy: 31.4, r: 1.5, fill: '#fff' })),
    anxious ? h('path', { d: 'M92 25.5 L102 23', fill: 'none', ...st, strokeWidth: 2.4 }) : null,
    mouth,
    h('path', { d: 'M111.5 42 C116 45 118 49 115.5 53', fill: 'none', ...st, strokeWidth: 1.8 }),
    anxious ? h('path', { d: 'M107 9 C104 15 104 18 107 18 C110 18 110 15 107 9 Z', fill: '#8fd3ff', stroke: ln, strokeWidth: 1.6, style: { animation: 'koinDrip 1.6s ease-in infinite' } }) : null,
    mood === 'thriving' ? h('g', { fill: 'var(--kip-patch)' },
      h('path', { d: 'M118 2 L120 8 L126 10 L120 12 L118 18 L116 12 L110 10 L116 8 Z', style: { transformBox: 'fill-box', transformOrigin: 'center', animation: 'koinTwinkle 1.4s ease-in-out infinite' } }),
      h('path', { d: 'M22 0 L23.4 4 L27.5 5.4 L23.4 6.8 L22 11 L20.6 6.8 L16.5 5.4 L20.6 4 Z', style: { transformBox: 'fill-box', transformOrigin: 'center', animation: 'koinTwinkle 1.4s .7s ease-in-out infinite' } })) : null
  );
  const bubbles = o.bubbles ? [0, 1, 2].map(i => h('span', { key: i, style: { position: 'absolute', right: -6 - i * 4, top: 10, width: 6 + i * 2, height: 6 + i * 2, borderRadius: '50%', border: '1.5px solid var(--kip-bubble)', animation: 'koinBubble 2.4s ' + (i * .8) + 's ease-out infinite', opacity: 0 } })) : null;
  return h('div', { style: { position: 'relative', width: size, height: size * 72 / 124, transform: o.flip ? 'scaleX(-1)' : 'none', transition: 'transform .35s ease' } }, svg, bubbles);
}

function kipLoader(React, step, mood) {
  const h = React.createElement; const pct = Math.min(1, (step + 0.5) / 5); const R = 46, C = 2 * Math.PI * R;
  return h('div', { style: { position: 'relative', width: 120, height: 120, flex: 'none' } },
    h('svg', { width: 120, height: 120, viewBox: '0 0 120 120', style: { position: 'absolute', inset: 0 } },
      h('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: 'var(--line)', strokeWidth: 6 }),
      h('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: 'var(--water-line)', strokeWidth: 6, strokeLinecap: 'round', strokeDasharray: C, strokeDashoffset: C * (1 - pct), transform: 'rotate(-90 60 60)', style: { transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' } })),
    h('div', { style: { position: 'absolute', inset: 0, animation: 'koinOrbit 1.8s linear infinite' } },
      h('div', { style: { position: 'absolute', left: 60 - 21, top: 60 - R - 13 } }, kip(React, { mood: mood || 'happy', size: 42 }))),
    h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--ink)' } }, Math.min(5, step + 1) + '/5'));
}
let AnimNum = null;
function animNum(React) {
  if (AnimNum) return AnimNum;
  AnimNum = function ({ value, fmt }) {
    const [v, setV] = React.useState(value); const ref = React.useRef(value);
    React.useEffect(() => {
      const from = ref.current, to = value; if (from === to) return; const t0 = performance.now(); let raf;
      const step = t => { const p = Math.min(1, (t - t0) / 520), e = 1 - Math.pow(1 - p, 3), cur = from + (to - from) * e; ref.current = cur; setV(cur); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
    }, [value]);
    return React.createElement(React.Fragment, null, fmt(v));
  };
  return AnimNum;
}

/* ---------- copy ---------- */
const GLOSSARY = {
  checking: ['Checking account', 'The everyday account you spend from and pay bills with.'],
  savings: ['Savings', 'Money set aside in a separate account. Koin never uses it to cover checking automatically.'],
  owe: ['What you owe', 'Debt you still have to repay, like credit card balances and loans.'],
  networth: ['Net worth', 'What you have minus what you owe. A mortgage and the home it pays for are left out of this demo.'],
  networth12: ['Net worth in a year', 'Where your net worth lands in 12 months if your habits and plan stay exactly as set.'],
  emergency: ['Emergency savings', 'How long your savings could cover your essential bills if your income stopped. One month counts as 30 days.'],
  essentials: ['Essential bills', 'Bills you must pay every month, like rent and utilities. You enter this amount.'],
  cushion: ['Safety cushion', 'The minimum you want to keep in checking for surprises. It’s a Koin setting, not a bank limit.'],
  lowest: ['Lowest balance ahead', 'The lowest checking is projected to get in the next 30 days. Koin counts money out before money in on the same day.'],
  forecast: ['30-day outlook', 'A day-by-day estimate of your checking balance from listed bills, paydays and your habits. An estimate, not a guarantee.'],
  extra: ['Extra payment', 'Paying more than the minimum on a debt. You owe less sooner, but the money leaves checking right away.'],
  goal: ['Goal contribution', 'How much you plan to put toward a goal each month. It’s a plan in Koin; changing it moves no money.'],
  nextgoal: ['Next goal', 'The goal you’ll finish first at your current monthly amounts.'],
  freed: ['Freed up', 'What your habit changes save each month compared with your usual spending, plus any side income.'],
  debtfree: ['Debt-free date', 'When every listed debt reaches zero at its monthly payment, with interest at each APR.'],
  leftover: ['Unassigned each month', 'Income left after bills, habits and goal payments. It stays in checking.'],
};
const STEP_TONE = { AI: ['ai-bg', 'ai-fg'], CODE: ['code-bg', 'code-fg'], DATA: ['data-bg', 'data-fg'], YOU: ['you-bg', 'you-fg'] };
const HOW = {
  stand: { title: 'Where do these numbers come from?', intro: 'Every figure is calculated in code from your account data and your own inputs.', steps: [
    ['DATA', 'Account data', 'Checking, savings, your card balance and bills from a made-up demo customer.'],
    ['CODE', 'Cleanup', 'Transfers between your own accounts are removed and refunds offset spending.'],
    ['YOU', 'Your inputs', 'Take-home pay, essential bills, safety cushion and goals from Setup or Kip.'],
    ['CODE', 'Financial engine', 'Net worth, emergency coverage and the outlook are math, never AI guesses.']], note: 'Demo data: only the listed bills, paydays, habits and goals are included.' },
  forecast: { title: 'How is the money stream built?', intro: 'Kip swims in your projected checking balance: day by day, then month by month, then year by year.', steps: [
    ['DATA', 'Opening balance', 'Today’s posted checking balance.'],
    ['DATA', 'Known bills and paydays', 'Rent, utilities and paychecks on their dates.'],
    ['YOU', 'Habits and goals', 'Monthly spending spread across each day; goal payments on the 15th and 20th.'],
    ['CODE', 'Verifier', 'Counts money out before money in and flags any day under your cushion.']], note: 'Each time the scale zooms out, the vertical scale compresses too.' },
  pay: { title: 'How is a payment checked?', intro: 'Before you add a payment, Koin runs the same checks the backend uses.', steps: [
    ['CODE', 'Financial engine', 'Re-runs your outlook with the payment on the chosen date.'],
    ['CODE', 'Verifier', 'Blocks it if checking would dip under your safety cushion on any day.'],
    ['AI', 'Strategist', 'Only if blocked: picks a safer, already-calculated option.'],
    ['AI', 'Coach', 'Explains the result using verified figures only.']], note: 'Koin never sends money. Approving adds the payment to your plan.' },
  approve: { title: 'What happens when I approve?', intro: 'Changes only happen when you say so, and only once.', steps: [
    ['CODE', 'Proposal locked', 'The exact change and your current numbers are sealed together.'],
    ['YOU', 'You approve', 'Nothing changes until you tap approve.'],
    ['CODE', 'Server checks', 'Ownership, freshness and the safety check run again.'],
    ['CODE', 'Saved once', 'One write with an audit record. Repeating it changes nothing.']], note: 'This edits your Koin plan. No bank transfer happens.' },
  kip: { title: 'How does Kip answer?', intro: 'Five steps. The math is always code; AI only interprets and explains.', steps: [
    ['AI', 'Coordinator', 'Reads your question or goal and decides what to check.'],
    ['CODE', 'Financial engine', 'Calculates the options with your real numbers.'],
    ['CODE', 'Verifier', 'Rejects anything that breaks your safety cushion.'],
    ['AI', 'Strategist', 'Picks the best verified option.'],
    ['AI', 'Coach', 'Explains it in plain words, using verified figures only.']], note: 'Without AI, you still get a calculator-only answer, clearly labeled.' },
  goals: { title: 'How do goals change the stream?', intro: 'Tell Kip a goal in plain words. Koin turns it into numbers and adds it to the stream.', steps: [
    ['AI', 'Coordinator', 'Reads the goal: what it is, how much, any rate or deadline.'],
    ['CODE', 'Financial engine', 'Savings goals take money out of checking on the 15th. Debts are paid on the 20th with interest.'],
    ['CODE', 'Verifier', 'Checks the new monthly amount against your budget and cushion.'],
    ['YOU', 'Fine-tune', 'Nudge the monthly amount on the goal’s card, or remove it.']], note: 'A mortgage replaces your rent, and isn’t counted in net worth in this demo.' },
};
const CHAT_STEPS = [['Coordinator', 'AI', 'Read your message'], ['Financial engine', 'CODE', 'Pulled your verified numbers'], ['Verifier', 'CODE', 'Checked your safety cushion'], ['Strategist', 'AI', 'Picked a verified option'], ['Coach', 'AI', 'Wrote this answer']];
const AI_OFF = 'Skipped: AI unavailable, calculator-only answer';
const chatTrace = live => CHAT_STEPS.map(x => x[1] === 'AI' && !live ? [x[0], x[1], x[0] === 'Coordinator' ? 'Skipped: message matched by keyword rules' : AI_OFF, true] : x);
const aiAvailable = () => !!(window.claude && window.claude.complete);
const GOAL_EXAMPLES = [['Vacation · $2,400 by June', 'Save $2,400 for a vacation by June'], ['Student loans · $18k at 5%', 'Pay off $18,000 in student loans at 5%'], ['Mortgage · $160k', 'Pay off my $160k mortgage']];

const SEED_RECEIPTS = [
  { id: 'r1', when: 'Example', title: 'Extra payment · $300 on Nov 7', verdict: 'Not recommended', tone: 'bad', kind: 'Payment review',
    facts: [['Lowest balance', '$237', '−$63'], ['Card balance', '$2,000', '$1,700']],
    checks: [['Stays above safety cushion', false], ['Uses verified figures only', true], ['Safer option found: Nov 15', true]],
    steps: [['Financial engine', 'CODE', 'Re-ran the outlook with the payment.'], ['Verifier', 'CODE', 'Checking dips to −$63 on Nov 14. Blocked.'], ['Strategist', 'AI', 'Picked: pay on Nov 15 instead.'], ['Coach', 'AI', 'Explained the safer date.']], note: 'Example receipt included with the demo. Nothing was paid.' },
  { id: 'r2', when: 'Example', title: 'Asked Kip · “What is a safety cushion?”', verdict: 'Answered', tone: 'info', kind: 'Kip answer',
    facts: [['Safety cushion', '$200', '$200']], checks: [['Uses verified figures only', true]],
    steps: [['Coordinator', 'AI', 'Recognized a definition question.'], ['Coach', 'AI', 'Explained the cushion with your number.']], note: 'Example receipt included with the demo. Concept answers use two steps.' },
];

/* ---------- goal parsing ---------- */
function normalizeGoal(inp) {
  const type = TYPES[inp.type] ? inp.type : (inp.kind === 'payoff' ? 'other_debt' : 'other_save');
  const T0 = TYPES[type]; const amount = +inp.amount;
  if (!(amount > 0)) return null;
  const g = { id: 'g' + Date.now().toString(36) + Math.floor(Math.random() * 99), kind: T0.kind, type, name: (inp.name || T0.name).slice(0, 28), fixed: false };
  if (T0.kind === 'save') {
    g.target = Math.round(amount); g.saved = Math.max(0, Math.round(+inp.saved || 0)); g.deadline = inp.deadline && /^\d{4}-\d\d-\d\d$/.test(inp.deadline) && inp.deadline > TODAY ? inp.deadline : null;
    let m = +inp.monthly; if (!(m > 0)) { const mo = g.deadline ? Math.max(1, between(TODAY, g.deadline) / 30) : 12; m = Math.ceil((g.target - g.saved) / mo / 5) * 5; }
    g.monthly = g.planMonthly = Math.round(m);
  } else {
    g.balance = Math.round(amount); g.apr = +inp.apr > 0 ? +inp.apr : T0.apr;
    let m = +inp.monthly; if (!(m > 0)) m = Math.ceil(amort(g.balance, g.apr, T0.years * 12) / 5) * 5;
    g.monthly = g.planMonthly = Math.round(m);
  }
  return g;
}
function parseGoal(text) {
  const t = text.toLowerCase().replace(/,/g, '');
  const TYPE_RE = [['mortgage', /mortgage|home loan/], ['student_loan', /student/], ['car_loan', /(car|auto) loan/], ['credit_card', /credit card/], ['personal_loan', /personal loan/],
    ['vacation', /vacation|trip|travel|holiday|getaway|japan|europe|beach/], ['wedding', /wedding/], ['house', /down payment|buy a (house|home)/], ['car', /\bcar\b/], ['education', /tuition|school|course|degree/], ['emergency', /emergency/]];
  let type = null; for (const [k, re] of TYPE_RE) if (re.test(t)) { type = k; break; }
  if (!type && !/goal|save|saving|pay off|payoff|loan|debt/.test(t)) return null;
  const apr = (t.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1];
  const mo = (t.match(/\$?\s?(\d+(?:\.\d+)?)\s*(k)?\s*(?:\/|a|per)\s*(?:mo\b|month)/) || []);
  const monthly = mo[1] ? +mo[1] * (mo[2] ? 1000 : 1) : null;
  const nums = [...t.matchAll(/\$?\s?(\d+(?:\.\d+)?)\s*(k|thousand)?(?![\d.]*\s*%)/g)].map(m => +m[1] * (m[2] ? 1000 : 1)).filter(n => n !== monthly && n !== +apr && !(n >= 2026 && n <= 2060));
  const amount = nums.length ? Math.max.apply(null, nums) : null;
  let deadline = null; const dm = t.match(/by\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{4})?/);
  if (dm) { const mi = MON.findIndex(x => x.toLowerCase() === dm[1]); let y = dm[2] ? +dm[2] : 2026; let dt = y + '-' + String(mi + 1).padStart(2, '0') + '-01'; if (dt <= TODAY) dt = (y + 1) + dt.slice(4); deadline = dt; }
  const inm = t.match(/in\s+(\d+)\s+months?/); if (!deadline && inm) deadline = addMonths(TODAY, +inm[1]);
  const kind = type ? TYPES[type].kind : (/pay off|payoff|loan|debt/.test(t) ? 'payoff' : 'save');
  return { type: type || (kind === 'payoff' ? 'other_debt' : 'other_save'), kind, amount, apr: apr ? +apr : null, monthly, deadline };
}

function moodLine(sim, P) {
  const d = fDay(sim.lowestDate), g = money(sim.gap);
  if (sim.leftover < 0 && sim.lowest >= 0) return 'Your plan spends ' + money(-sim.leftover) + ' more than comes in each month. The stream drains over time. Let’s trim something.';
  return {
    panic: 'Uh-oh. Checking goes below zero on ' + d + '. Let’s undo something splashy.',
    worried: 'We dip under your safety cushion on ' + d + '. I’d hold off on big moves until payday.',
    nervous: 'Water gets shallow around ' + d + ': just ' + g + ' above your cushion. Payday’s right after, hang in there.',
    happy: 'Smooth swimming. Your lowest point stays ' + g + ' above your cushion.',
    thriving: 'Look at us go! Deep water all month: your lowest point stays ' + g + ' above your cushion' + (sim.leftover > 0 ? ', with ' + money(sim.leftover) + ' a month to spare.' : '.'),
  }[sim.mood];
}
function kipSays(s, sim, plan, P) {
  if (sim.mood === 'panic' || sim.mood === 'worried') return moodLine(sim, P);
  if (s.lastLever && s.lastLever.indexOf('goal:') === 0) {
    const g = sim.goals.find(x => x.id === s.lastLever.slice(5)); const r = g && sim.goalMap[g.id];
    if (g && r) return 'New goal: ' + g.name + '! At ' + money(goalMonthly(g, s.lv)) + ' a month, ' + (r.months === null ? 'it never gets there. Let’s raise the amount.' : (g.kind === 'save' ? 'you’ll have ' + money(g.target) : 'it’s paid off') + ' in ' + fmtDur(r.months) + '.');
  }
  const lev = LEVERS.find(l => l.id === s.lastLever);
  const rg = sim.goals.find(g => g.id === s.route);
  const routeTxt = rg ? 'Routed to your ' + rg.name.toLowerCase() + ' from next month.' : 'It stays in checking, so the water rises.';
  if (!lev) return (s.lastLever === 'route' ? 'Freed-up cash now flows to ' + (rg ? rg.name.toLowerCase() : 'checking') + '. ' : 'Hi, I’m Kip! Drag any habit, or tell me a goal, and watch the stream change. ') + moodLine(sim, P);
  const v = s.lv[lev.id], d = v - s.plan[lev.id];
  if (d === 0) return moodLine(sim, P);
  if (lev.kind === 'spend') return d < 0 ? lev.label + ' at ' + money(v) + ' a month frees ' + money(-d) + '. That’s ' + money(-d * 12) + ' a year. ' + routeTxt
    : lev.label + ' up ' + money(d) + ' a month. Ripple alert: that’s ' + money(d * 12) + ' a year.';
  if (lev.id === 'side') return d > 0 ? 'Side hustle! ' + smoney(d) + ' a month. ' + routeTxt : 'Less side income, smaller splash.';
  if (lev.id === 'extraDebt') return d > 0 ? 'Card cleared ' + (sim.debtDate ? 'by ' + fMonth(sim.debtDate) : 'eventually') + (plan.debtDate ? ' instead of ' + fMonth(plan.debtDate) : '') + '. Less interest for the bank, more for you.' : 'Smaller card payments mean more interest. Just saying.';
  return d > 0 ? P.goalName + ' in ' + fmtDur(sim.goalMonths) + '. Kip approves.' : 'Slower saving: ' + P.goalName.toLowerCase() + (sim.goalDate ? ' takes ' + fmtDur(sim.goalMonths) : ' never reached at this rate') + '.';
}
function durDelta(a, b) {
  if (a === b || (a !== null && b !== null && Math.abs(a - b) < 1 / 60)) return { text: 'no change', tone: 'muted', show: false };
  if (b === null) return { text: 'never at this rate', tone: 'bad', show: true };
  if (a === null) return { text: 'now reachable', tone: 'good', show: true };
  return { text: fmtDur(Math.abs(a - b)) + ' ' + (b < a ? 'sooner' : 'later'), tone: b < a ? 'good' : 'bad', show: true };
}
function moneyDelta(a, b) { const d = Math.round(b - a); return { text: d === 0 ? 'no change' : smoney(d), tone: d === 0 ? 'muted' : d > 0 ? 'good' : 'bad', show: d !== 0 }; }
function nowStamp() { const d = new Date(); let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return 'Nov 7 · ' + h + ':' + m + ' ' + ap; }
function stepRows(list, active) {
  return list.map((x, i) => { const [bg, fg] = STEP_TONE[x[1]]; const state = x[3] ? 'skipped' : active === undefined ? 'done' : i < active ? 'done' : i === active ? 'running' : 'waiting';
    return { role: x[0], kind: x[1], text: x[2], kBg: T(bg), kFg: T(fg), state, stateLabel: { done: 'Done', skipped: 'Skipped', running: 'Working…', waiting: '' }[state], op: state === 'waiting' ? .35 : state === 'skipped' ? .5 : 1, dot: state === 'running' ? T('accent') : state === 'waiting' ? T('line') : T('good'), n: i + 1, last: i === list.length - 1 }; });
}

/* ---------- handlers ---------- */
const DEF = { theme: 'light', lv: BASE, plan: BASE, route: 'cash', P: PROFILE, goals: GOALS0, planned: [], pay: { amount: '300', dateIdx: 0, phase: 'idle', step: 0 }, payHover: false,
  goalRev: { id: null, phase: 'idle', step: 0 }, lockRev: { phase: 'idle', step: 0 }, hover: null, scrollX: 0, lastLever: null, ripple: 0, drawer: null, setup: false, how: null, tip: null, goalText: '',
  receipts: SEED_RECEIPTS, openRec: null, chat: [{ role: 'kip', text: 'Hey! I’m Kip, your money sidekick. Ask me anything, or tell me a goal like “pay off my student loans” and I’ll add it to your stream.' }], chatInput: '', chatBusy: false, chatStep: 0, traceOpen: -1, toast: null };

function handlers(c) {
  if (c._h) return c._h;
  const set = (p) => c.setState(p);
  const S = () => Object.assign({}, DEF, c.state);
  const H = {}; const cache = {};
  const memo = (k, f) => cache[k] || (cache[k] = f);
  const idle = { goalRev: { id: null, phase: 'idle', step: 0 }, lockRev: { phase: 'idle', step: 0 } };
  H.lever = id => memo('lv' + id, e => { const v = +e.target.value; c.setState(st => { const s = Object.assign({}, DEF, st); return Object.assign({ lv: Object.assign({}, s.lv, { [id]: v }), lastLever: id, ripple: s.ripple + 1 }, idle); }); });
  H.routeSel = e => { const r = e.target.value; c.setState(st => ({ route: r, lastLever: 'route', ripple: (st.ripple || 0) + 1, lockRev: { phase: 'idle', step: 0 } })); };
  H.reset = () => set(Object.assign({ lv: S().plan, goals: S().goals.map(g => g.fixed ? g : Object.assign({}, g, { monthly: g.planMonthly })), lastLever: null }, idle));
  H.bump = (id, d) => memo('bp' + id + d, () => c.setState(st => { const s = Object.assign({}, DEF, st);
    if (id === 'emergency' || id === 'card') { const lid = id === 'emergency' ? 'goal' : 'extraDebt'; const l = LEVERS.find(x => x.id === lid); const v = Math.min(l.max, Math.max(l.min, s.lv[lid] + d)); return Object.assign({ lv: Object.assign({}, s.lv, { [lid]: v }), lastLever: lid, ripple: s.ripple + 1 }, idle); }
    return Object.assign({ goals: s.goals.map(g => g.id === id ? Object.assign({}, g, { monthly: Math.max(0, g.monthly + d) }) : g), lastLever: null, ripple: s.ripple + 1 }, idle); }));
  H.removeGoal = id => memo('rg' + id, () => { const s = S(); const g = s.goals.find(x => x.id === id); if (!g || g.fixed) return; set({ goals: s.goals.filter(x => x.id !== id), route: s.route === id ? 'cash' : s.route, ripple: s.ripple + 1, lastLever: null }); H.toast(g.name + ' removed from your stream.'); });
  H.applyGoal = (inp, live) => {
    const s = S(); const g = normalizeGoal(inp || {});
    if (!g) return { ok: false, error: 'Need a dollar amount for the goal (target to save, or balance owed).' };
    let goals = s.goals.slice(), P = s.P, gid = g.id;
    if (g.type === 'emergency') { P = Object.assign({}, P, { goalTarget: g.target }); gid = 'emergency'; }
    else if (g.type === 'credit_card') { P = Object.assign({}, P, { owe: g.balance, apr: g.apr }); gid = 'card'; }
    else { const i = goals.findIndex(x => !x.fixed && x.type === g.type); if (i >= 0) { gid = goals[i].id; goals[i] = Object.assign({}, g, { id: gid }); } else goals.push(g); }
    const ex = s.planned.map(p => ({ amount: p.amount, date: p.date }));
    const before = compute(s.lv, s.P, s.goals, s.route, ex, false), after = compute(s.lv, P, goals, s.route, ex, false);
    const r = after.goalMap[gid]; const gg = after.goals.find(x => x.id === gid);
    set(Object.assign({ goals, P, lastLever: 'goal:' + gid, ripple: s.ripple + 1 }, idle));
    const ok = after.leftover >= 0 && after.lowest >= P.cushion;
    H.addReceipt({ title: 'Goal added · ' + gg.name + ' ' + money(gg.kind === 'save' ? gg.target : gg.balance), verdict: ok ? 'Added' : 'Added · over budget', tone: ok ? 'good' : 'warn', kind: 'Goal from Kip',
      facts: [['Monthly toward it', '—', money(goalMonthly(gg, s.lv))], [gg.kind === 'save' ? 'Reached in' : 'Paid off in', '—', r.months === null ? 'Never' : fmtDur(r.months)], ['Unassigned each month', money(before.leftover), money(after.leftover)], ['Lowest balance ahead', money(before.lowest), money(after.lowest)]],
      checks: [['Fits your monthly budget', after.leftover >= 0], ['Stays above safety cushion', after.lowest >= P.cushion], ['Uses verified figures only', true]],
      steps: [live ? ['Coordinator', 'AI', 'Read the goal from your message.'] : ['Coordinator', 'AI', 'Skipped: goal read by keyword rules', true], ['Financial engine', 'CODE', 'Added it to the stream and recalculated.'], ['Verifier', 'CODE', ok ? 'Fits your budget and cushion.' : 'Over budget: flagged for you.'], live ? ['Coach', 'AI', 'Confirmed it with verified figures.'] : ['Coach', 'AI', AI_OFF, true]], note: 'Goals are plans in Koin. No money moved.' });
    return { ok: true, goal: gg.name, type: gg.type, kind: gg.kind, amount: gg.kind === 'save' ? gg.target : gg.balance, apr: gg.apr || null, monthlyPayment: Math.round(goalMonthly(gg, s.lv)), reachedOrPaidOffIn: r.months === null ? 'never at this monthly amount' : fmtDur(r.months), date: r.date ? fMonth(r.date) : null,
      totalInterest: r.interest ? Math.round(r.interest) : null, unassignedPerMonthBefore: Math.round(before.leftover), unassignedPerMonthAfter: Math.round(after.leftover), lowestBalanceAfter: Math.round(after.lowest), safetyCushion: P.cushion, overBudget: !ok, replacedRent: gg.type === 'mortgage' ? P.rent : 0 };
  };
  H.removeGoalByName = name => { const s = S(); const n = String(name || '').toLowerCase(); const g = s.goals.find(x => !x.fixed && (x.name || '').toLowerCase().indexOf(n) >= 0 || (!x.fixed && n.indexOf((x.name || '').toLowerCase()) >= 0)); if (!g) return { ok: false, error: 'No matching goal you added.' }; H.removeGoal(g.id)(); return { ok: true, removed: g.name }; };
  H.toggleTheme = () => set({ theme: S().theme === 'dark' ? 'light' : 'dark' });
  H.scrollRef = el => {
    if (!el || el === c._scroller) return; c._scroller = el; c._vw = el.clientWidth;
    el.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.target.closest('[data-noscrolljack]')) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    window.addEventListener('resize', () => { c._vw = el.clientWidth; c.forceUpdate(); });
  };
  H.onScroll = e => { c._sx = e.currentTarget.scrollLeft; if (!c._raf) c._raf = requestAnimationFrame(() => { c._raf = 0; set({ scrollX: c._sx }); }); };
  H.jump = x => memo('jp' + x, () => c._scroller && c._scroller.scrollTo({ left: x, behavior: 'smooth' }));
  H.chartMove = e => { const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / (c._fitS || 1); const xs = c._xs || []; let bi = 0, bd = 1e9; xs.forEach((v, i) => { const d = Math.abs(v - x); if (d < bd) { bd = d; bi = i; } }); if (bi !== S().hover) set({ hover: bi }); };
  H.chartLeave = () => set({ hover: null });
  H.toast = t => { set({ toast: t }); clearTimeout(c._tt); c._tt = setTimeout(() => set({ toast: null }), 3600); };
  H.addReceipt = r => c.setState(st => ({ receipts: [Object.assign({ id: 'r' + Date.now() + Math.floor(Math.random() * 99), when: nowStamp() }, r)].concat(st.receipts || SEED_RECEIPTS) }));
  const runSteps = (key, n, extra) => { let i = 0; c.setState({ [key]: Object.assign({}, S()[key], extra || {}, { phase: 'reviewing', step: 0 }) }); clearInterval(c['_iv' + key]);
    c['_iv' + key] = setInterval(() => { i++; const cur = Object.assign({}, DEF, c.state)[key]; if (i >= n) { clearInterval(c['_iv' + key]); set({ [key]: Object.assign({}, cur, { phase: 'done', step: n }) }); } else set({ [key]: Object.assign({}, cur, { step: i }) }); }, 480); };
  H.payAmount = e => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 5); set({ pay: Object.assign({}, S().pay, { amount: v, phase: 'idle' }) }); };
  H.payDate = i => memo('pd' + i, () => set({ pay: Object.assign({}, S().pay, { dateIdx: i, phase: 'idle' }) }));
  H.payEnter = () => set({ payHover: true }); H.payLeave = () => set({ payHover: false });
  H.payReview = () => { if (!(+S().pay.amount > 0)) return; runSteps('pay', 4); };
  H.paySafer = () => { const r = c._payResult; if (!r || !r.safer) return; set({ pay: Object.assign({}, S().pay, r.safer.patch, { phase: 'idle' }) }); setTimeout(() => runSteps('pay', 4), 30); };
  H.payApprove = () => { const s = S(), r = c._payResult; if (!r || !r.ok) return; const item = { id: 'p' + Date.now(), amount: +s.pay.amount, date: PAY_DATES[s.pay.dateIdx].date };
    set({ planned: s.planned.concat([item]), pay: { amount: '', dateIdx: 2, phase: 'idle', step: 0 } });
    H.addReceipt({ title: 'Extra payment · ' + money(item.amount) + ' on ' + fDay(item.date), verdict: 'Approved', tone: 'good', kind: 'Payment review', facts: r.facts, checks: [['Stays above safety cushion', true], ['Uses verified figures only', true], ['Approved once by you', true]], steps: r.stepsRaw, note: 'Added to your Koin plan. No money moved.' });
    H.toast('Added to your plan. Koin never moves money, you make the payment.'); };
  H.payCancel = () => set({ pay: Object.assign({}, S().pay, { phase: 'idle' }) });
  H.removePlanned = id => memo('rm' + id, () => { set({ planned: S().planned.filter(p => p.id !== id) }); H.toast('Removed from your plan.'); });
  H.goalReview = id => memo('gr' + id, () => runSteps('goalRev', 3, { id }));
  H.goalApprove = id => memo('ga' + id, () => { const s = S(), g = c._goalResult && c._goalResult[id]; const patch = { goalRev: { id: null, phase: 'idle', step: 0 } };
    if (id === 'emergency') patch.plan = Object.assign({}, s.plan, { goal: s.lv.goal }); else if (id === 'card') patch.plan = Object.assign({}, s.plan, { extraDebt: s.lv.extraDebt });
    else patch.goals = s.goals.map(x => x.id === id ? Object.assign({}, x, { planMonthly: x.monthly }) : x);
    set(patch);
    if (g) H.addReceipt({ title: 'Goal change · ' + g.name + ' ' + g.from + ' → ' + g.to + ' a month', verdict: 'Approved', tone: 'good', kind: 'Goal review', facts: g.facts, checks: [['Fits your monthly budget', true], ['Approved once by you', true]], steps: g.stepsRaw, note: 'Changed your monthly goal setting. No money moved.' });
    H.toast('Goal plan updated.'); });
  H.goalCancel = () => set({ goalRev: { id: null, phase: 'idle', step: 0 } });
  H.lockReview = () => runSteps('lockRev', 3);
  H.lockApprove = () => { const s = S(), g = c._lockResult; set({ plan: s.lv, goals: s.goals.map(x => x.fixed ? x : Object.assign({}, x, { planMonthly: x.monthly })), lockRev: { phase: 'idle', step: 0 }, lastLever: null });
    H.addReceipt({ title: 'Habit plan · ' + (g ? g.summary : 'updated'), verdict: 'Approved', tone: 'good', kind: 'Habit review', facts: g ? g.facts : [], checks: [['Stays above safety cushion', true], ['Fits your monthly budget', true], ['Approved once by you', true]], steps: g ? g.stepsRaw : [], note: 'Your new habits are now the plan everything compares against.' });
    H.toast('Locked in! These habits are your new plan.'); };
  H.lockCancel = () => set({ lockRev: { phase: 'idle', step: 0 } });
  H.lockDock = x => memo('ld' + x, () => { H.lockReview(); H.jump(x)(); });
  H.openKip = () => set({ drawer: S().drawer === 'kip' ? null : 'kip' });
  H.openReceipts = () => set({ drawer: S().drawer === 'receipts' ? null : 'receipts', openRec: null });
  H.closeDrawer = () => set({ drawer: null });
  H.openRec = id => memo('or' + id, () => set({ openRec: id }));
  H.closeRec = () => set({ openRec: null });
  H.openSetup = () => set({ setup: true }); H.closeSetup = () => set({ setup: false });
  H.prof = k => memo('pf' + k, e => { const raw = e.target.value; const v = k === 'goalName' ? raw : Math.max(0, +(raw.replace(/[^0-9.]/g, '')) || 0); set({ P: Object.assign({}, S().P, { [k]: v }) }); });
  H.how = k => memo('hw' + k, () => set({ how: k }));
  H.closeHow = () => set({ how: null });
  H.stop = e => e.stopPropagation();
  H.showTip = e => { const el = e.currentTarget, r = el.getBoundingClientRect(), k = c._fitS || 1; set({ tip: { term: el.getAttribute('data-term'), x: (r.left + r.width / 2) / k, y: r.top / k, b: r.bottom / k } }); };
  H.hideTip = () => set({ tip: null });
  H.chatRef = el => { c._chatEl = el; };
  // The quick-ask row scrolls sideways; let a normal mouse wheel do that.
  H.chipsRef = el => { if (!el || el._wheel) return; el._wheel = true; el.addEventListener('wheel', e => { if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); };
  H.chatScroll = () => requestAnimationFrame(() => { const el = c._chatEl; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); });
  H.chatInput = e => set({ chatInput: e.target.value });
  H.chatKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); H.send(); } };
  H.goalText = e => set({ goalText: e.target.value });
  H.goalKey = e => { if (e.key === 'Enter') { e.preventDefault(); H.goalSend(); } };
  H.goalSend = () => { const t = S().goalText.trim(); if (!t) return; set({ goalText: '' }); H.send(t); };
  H.ask = q => memo('ask' + q, () => H.send(q));
  H.trace = i => memo('tr' + i, () => set({ traceOpen: S().traceOpen === i ? -1 : i }));
  H.send = async (q) => {
    const s = S(); const text = (typeof q === 'string' ? q : s.chatInput).trim(); if (!text || s.chatBusy) return;
    const chat = s.chat.concat([{ role: 'user', text }]);
    const aiOn = aiAvailable(); let step = aiOn ? 0 : 1;
    set({ chat, chatInput: '', chatBusy: true, chatStep: step, drawer: 'kip' });
    // Calculator mode only steps through the code checks that actually run.
    H.chatScroll(); clearInterval(c._civ); c._civ = setInterval(() => { step = Math.min(aiOn ? 4 : 2, step + 1); set({ chatStep: step }); }, 650);
    let answer, live = true, usedTool = false;
    const tools = [
      { name: 'add_goal', description: 'Add (or update) a financial goal on the user’s Koin money stream when they state a goal: saving for something, or paying off a debt. Returns verified figures to use in your reply.',
        input_schema: { type: 'object', properties: {
          kind: { type: 'string', enum: ['save', 'payoff'] },
          type: { type: 'string', enum: Object.keys(TYPES) },
          name: { type: 'string', description: 'Short friendly name, e.g. “Japan trip”, “Student loans”' },
          amount: { type: 'number', description: 'Dollars. Save goals: target amount. Payoff goals: current balance owed.' },
          saved: { type: 'number', description: 'Already saved toward it, if mentioned' },
          apr: { type: 'number', description: 'Annual interest rate in percent, debts only, if mentioned' },
          monthly: { type: 'number', description: 'Monthly amount they want to put toward it, if mentioned' },
          deadline: { type: 'string', description: 'Target date YYYY-MM-DD if mentioned (today is 2026-11-07)' } }, required: ['kind', 'type', 'amount'] },
        run: async (input) => { usedTool = true; return JSON.stringify(H.applyGoal(input, true)); } },
      { name: 'remove_goal', description: 'Remove a goal the user added earlier.', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
        run: async (input) => { usedTool = true; return JSON.stringify(H.removeGoalByName(input.name)); } }];
    try {
      if (!window.claude || !window.claude.complete) throw new Error('no ai');
      const ctx = c._ctx || {};
      answer = await window.claude.complete({ max_tokens: 600, system: 'You are Kip, a cheerful koi fish and the money sidekick inside the Koin personal finance app. Answer in 2-4 short sentences (max 70 words), plain words, playful but clear. Plain text only: no markdown, no asterisks, no emoji. Use only figures given or returned by tools; never invent numbers. Write durations as “X months and Y days” (a month is 30 days), never decimal months. Koin never moves money; approvals only change the user’s plan. A payment is unsafe if checking would dip under the safety cushion. When the user states a goal (saving for something or paying off a debt), call add_goal right away, then confirm it with the returned figures. If the rate, monthly amount or deadline is missing, still call add_goal: Koin fills in typical defaults (mention that they can adjust it on the goal card). Only ask a follow-up if there is no dollar amount at all. Current figures (made-up demo data): ' + JSON.stringify(ctx),
        messages: chat.filter((m, i) => i > 0).slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })), tools });
    } catch (err) {
      live = false; await new Promise(r => setTimeout(r, 1500)); const pg = parseGoal(text);
      const isQ = /\?\s*$/.test(text) || /^(how|when|why|what|where|can|could|should|is|am|do|does|will)\b/i.test(text);
      if (isQ) answer = canned(text, c._ctx || {});
      else if (pg && pg.amount) { const r = H.applyGoal(pg, false); usedTool = true; answer = r.ok ? 'Added ' + r.goal + ' to your stream! At ' + money(r.monthlyPayment) + ' a month ' + (r.kind === 'save' ? 'you’ll reach ' + money(r.amount) : 'it’s paid off') + ' in ' + r.reachedOrPaidOffIn + (r.date ? ' (' + r.date + ')' : '') + '.' + (r.replacedRent ? ' I swapped your ' + money(r.replacedRent) + ' rent for the mortgage payment.' : '') + (r.overBudget ? ' Heads up: that’s over budget, you’d have ' + money(r.unassignedPerMonthAfter) + ' a month unassigned.' : ' You’d still have ' + money(r.unassignedPerMonthAfter) + ' a month unassigned.') : r.error; }
      else if (pg && !pg.amount) answer = 'Ooh, a new goal! How much is it? Tell me the target to save, or the balance you owe.';
      else answer = canned(text, c._ctx || {});
    }
    clearInterval(c._civ);
    answer = String(answer || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?/gu, '').trim();
    c.setState(st => ({ chat: (st.chat || chat).concat([{ role: 'kip', text: answer || 'Done!', trace: true, live }]), chatBusy: false, chatStep: 5 })); H.chatScroll();
    if (!usedTool) H.addReceipt({ title: 'Asked Kip · “' + (text.length > 38 ? text.slice(0, 38) + '…' : text) + '”', verdict: live ? 'Answered' : 'Calculator only', tone: 'info', kind: 'Kip answer', facts: [['Lowest balance ahead', money((c._ctx || {}).lowestBalance || 0), money((c._ctx || {}).lowestBalance || 0)]], checks: [['Uses verified figures only', true]], steps: chatTrace(live).map(x => [x[0], x[1], x[2] + (x[3] ? '' : '.'), x[3]]), note: live ? 'Answer written by AI from verified figures.' : 'AI unavailable: calculator-only answer.' });
  };
  c._h = H; return H;
}
function canned(q, x) {
  q = q.toLowerCase(); const hb = x.habits || {}; const goals = x.goals || [];
  if (/lowest|low point|shallow/.test(q)) { const gap = (x.lowestBalance || 0) - (x.safetyCushion || 0);
    return 'Checking bottoms out at ' + money(x.lowestBalance) + ' on ' + x.lowestDate + ', ' + money(Math.abs(gap)) + (gap >= 0 ? ' above' : ' below') + ' your ' + money(x.safetyCushion) + ' cushion. Bills that land before payday (' + x.paydays + ') pull it down, and I count money out before money in on the same day.'; }
  if (/debt.?free|paid off|pay(ing)? off/.test(q)) { const d = goals.filter(g => g.kind === 'payoff');
    if (!d.length) return 'You have no debts listed, so you’re already debt-free in Koin.';
    return d.map(g => g.name + ': ' + (g.date ? g.date + ' (' + g.finishesIn + ')' : 'never at this rate') + ' at ' + money(g.monthly) + ' a month').join('. ') + '. Raise the extra card payment slider to see it move sooner.'; }
  if (/how long|full|emergency fund/.test(q)) { const g = goals.find(x => x.type === 'emergency') || goals.find(x => x.kind === 'save');
    if (!g) return 'You don’t have a savings goal yet. Tell me one, like “save $3,000 for emergencies”.';
    return 'At ' + money(g.monthly) + ' a month, ' + g.name + ' is full ' + (g.date ? 'in ' + g.finishesIn + ' (' + g.date + ')' : 'never at this rate') + '. You’ve saved ' + money(g.saved) + ' of ' + money(g.amount) + '.'; }
  if (/pay|card|debt/.test(q)) return 'Paying $300 today: checking would ' + ((x.extraPayment300 || {}).today || 'need a review first') + ', against your ' + money(x.safetyCushion) + ' cushion. Try the extra-payment card to check other dates; Nov 15, after payday, is ' + ((x.extraPayment300 || {}).nov15 || 'worth checking') + '.';
  if (/leak|spend|where|habit/.test(q)) return 'Your biggest streams out: groceries ' + money(hb.groceries) + ', dining out ' + money(hb.dining) + ' and shopping ' + money(hb.shopping) + ' a month. Trimming dining by $100 frees $1,200 a year.';
  if (/cushion|safety/.test(q)) return 'Your safety cushion is ' + money(x.safetyCushion) + ': the least you want in checking for surprises. I block any move that would dip below it.';
  return 'Right now your lowest balance ahead is ' + money(x.lowestBalance) + ' on ' + x.lowestDate + ', and you have ' + money(x.unassignedPerMonth) + ' a month unassigned. Tell me a goal and I’ll add it to the stream.';
}

/* ---------- view ---------- */
function view(c, React, L) {
  const s = Object.assign({}, DEF, c.state); const H = handlers(c); const P = s.P; const h = React.createElement;
  const planned = s.planned.map(p => ({ amount: p.amount, date: p.date }));
  const pre = [compute(s.lv, P, s.goals, s.route, planned, false), compute(s.plan, P, s.goals, s.route, planned, true)];
  const yrs = horizonFor(pre); const HM = 12 * yrs - 1;
  const sim = compute(s.lv, P, s.goals, s.route, planned, false, HM), plan = compute(s.plan, P, s.goals, s.route, planned, true, HM);
  const changed = LEVERS.some(l => s.lv[l.id] !== s.plan[l.id]) || s.goals.some(g => !g.fixed && g.monthly !== g.planMonthly);
  const hist = history(P, s.lv);
  // payment preview
  const pAmt = +s.pay.amount || 0, pDate = PAY_DATES[s.pay.dateIdx].date;
  const prev = pAmt > 0 ? compute(s.lv, P, s.goals, s.route, planned.concat([{ amount: pAmt, date: pDate, preview: true }]), false, HM) : null;
  const payOk = prev ? prev.lowest >= P.cushion : false;
  let safer = null;
  if (prev && !payOk) {
    const alt = PAY_DATES.findIndex((d, i) => i > s.pay.dateIdx && compute(s.lv, P, s.goals, s.route, planned.concat([{ amount: pAmt, date: d.date }]), false).lowest >= P.cushion);
    if (alt >= 0) safer = { label: 'Pay ' + money(pAmt) + ' on ' + PAY_DATES[alt].sub + ' instead', patch: { dateIdx: alt } };
    else { const di = between(TODAY, pDate); const minAfter = Math.min.apply(null, sim.days.slice(di).map(d => d.low)); const mx = Math.floor((minAfter - P.cushion) / 10) * 10;
      if (mx >= 10) safer = { label: 'Pay ' + money(mx) + ' on ' + PAY_DATES[s.pay.dateIdx].sub + ' instead', patch: { amount: String(mx) } }; }
  }
  const payFacts = prev ? [['Lowest balance', money(sim.lowest), money(prev.lowest)], ['Card balance', money(sim.owe), money(prev.owe)], ['Card paid off', sim.debtDate ? fMonth(sim.debtDate) : 'Never', prev.debtDate ? fMonth(prev.debtDate) : 'Never']] : [];
  const payStepsRaw = [['Financial engine', 'CODE', 'Re-ran your 30-day outlook with the payment.'],
    ['Verifier', 'CODE', payOk ? 'Every day stays above your ' + money(P.cushion) + ' cushion. Passed.' : 'Checking would dip to ' + money(prev ? prev.lowest : 0) + ' on ' + fDay(prev ? prev.lowestDate : TODAY) + '. Blocked.'],
    ['Strategist', 'AI', payOk ? 'No safer option needed.' : safer ? 'Safer option: ' + safer.label.toLowerCase() + '.' : 'No safe option found this month.', payOk],
    ['Coach', 'AI', 'Wrote the summary with verified figures only.']];
  c._payResult = { ok: payOk, safer, facts: payFacts, stepsRaw: payStepsRaw };
  const lockOk = sim.leftover >= 0 && sim.lowest >= P.cushion;
  const spendDelta = sim.disc + s.lv.subs - (plan.disc + s.plan.subs);
  const lockFacts = [['Habit spending / mo', money(plan.disc + s.plan.subs), money(sim.disc + s.lv.subs)], ['Net worth in a year', money(plan.nw12), money(sim.nw12)], [P.goalName + ' in', fmtDur(plan.goalMonths), fmtDur(sim.goalMonths)], ['Card paid off', plan.debtDate ? fMonth(plan.debtDate) : 'Never', sim.debtDate ? fMonth(sim.debtDate) : 'Never']];
  const lockStepsRaw = [['Financial engine', 'CODE', 'Re-ran your outlook and the years ahead with the new habits.'], ['Verifier', 'CODE', lockOk ? 'Stays above your cushion and within budget. Passed.' : 'Breaks your cushion or budget. Blocked.'], ['Coach', 'AI', 'Summarized what changes.']];
  c._lockResult = { facts: lockFacts, stepsRaw: lockStepsRaw, summary: (spendDelta <= 0 ? money(-spendDelta) + ' less' : money(spendDelta) + ' more') + ' spending a month' };
  c._ctx = { today: 'Nov 7, 2026', checking: P.checking, savings: P.savings, safetyCushion: P.cushion, lowestBalance: Math.round(sim.lowest), lowestDate: fDay(sim.lowestDate), netWorthNow: Math.round(sim.nwNow), netWorthInAYear: Math.round(sim.nw12),
    emergencyCoverage: fmtDur(sim.cov), unassignedPerMonth: Math.round(sim.leftover), takeHomePay: P.income, essentialBills: sim.essentials, habits: Object.fromEntries(LEVERS.map(l => [l.id, s.lv[l.id]])), freedCashGoesTo: s.route, paydays: 'Nov 14 and Nov 28', rent: sim.hasMortgage ? 'replaced by mortgage' : money(P.rent) + ' on Nov 10',
    goals: sim.goals.map(g => { const r = sim.goalMap[g.id]; return { name: g.name, type: g.type, kind: g.kind, amount: g.kind === 'save' ? g.target : g.balance, saved: g.saved || 0, apr: g.apr || null, monthly: Math.round(sim.gs.find(x => x.g.id === g.id).m), finishesIn: r.months === null ? 'never' : fmtDur(r.months), date: r.date ? fMonth(r.date) : null }; }),
    extraPayment300: (() => { const t = compute(s.lv, P, s.goals, s.route, planned.concat([{ amount: 300, date: TODAY }]), false).lowest, n = compute(s.lv, P, s.goals, s.route, planned.concat([{ amount: 300, date: '2026-11-15' }]), false).lowest;
      return { today: (t >= P.cushion ? 'stay at or above ' : 'dip to ') + money(t), nov15: n >= P.cushion ? 'above your cushion' : 'still under your cushion' }; })() };

  /* geometry */
  const pxYear = Math.max(90, Math.min(190, Math.round(2000 / Math.max(1, yrs - 1))));
  const x0 = L.padL + 10 * L.pxPast, x29 = x0 + 29 * L.pxDay, xY = x29 + 11 * L.pxMonth, xEnd = xY + (yrs - 1) * pxYear;
  const yrIdx = []; for (let k = 2; k <= yrs; k++) yrIdx.push(12 * k - 2);
  const series = r => hist.map(d => d.low).concat(r.days.map(d => d.low), r.months.slice(0, 11).map(m => m.bal), yrIdx.map(i => r.months[i].bal));
  const N = 51 + yrIdx.length;
  const X = i => i < 10 ? L.padL + i * L.pxPast : i < 40 ? x0 + (i - 10) * L.pxDay : i < 51 ? x29 + (i - 39) * L.pxMonth : xY + (i - 50) * pxYear;
  const xs = []; for (let i = 0; i < N; i++) xs.push(X(i)); c._xs = xs;
  const sv = series(sim), pv = series(plan), gv = prev ? series(prev) : null;
  const allMax = Math.max.apply(null, sv.concat(pv, gv || []));
  const dmax = Math.max(4000, allMax);
  const f = v => Math.sign(v) * Math.log(1 + Math.abs(v) / 250); const y0 = f(-450), y1 = f(dmax * 1.05);
  const Y = v => L.chartTop + L.chartH - (f(Math.max(-450, v)) - y0) / (y1 - y0) * L.chartH;
  const pts = arr => arr.map((v, i) => [X(i), Y(v)]);
  const path = p => { const n = p.length; const dx = [], m = []; for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
    const t = [m[0]]; for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2; t[n - 1] = m[n - 2];
    for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b; if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
    let d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1); for (let i = 0; i < n - 1; i++) { const hh = dx[i] / 3; d += 'C' + (p[i][0] + hh).toFixed(1) + ',' + (p[i][1] + t[i] * hh).toFixed(1) + ' ' + (p[i + 1][0] - hh).toFixed(1) + ',' + (p[i + 1][1] - t[i + 1] * hh).toFixed(1) + ' ' + p[i + 1][0].toFixed(1) + ',' + p[i + 1][1].toFixed(1); } return d; };
  const sp = pts(sv); const lineD = path(sp); const bottom = L.chartTop + L.chartH;
  const areaD = lineD + 'L' + xEnd + ',' + bottom + 'L' + L.padL + ',' + bottom + 'Z';
  const lastM = sim.months[sim.months.length - 1].date;
  const dateOf = i => i < 10 ? hist[i].date : i < 40 ? sim.days[i - 10].date : i < 51 ? sim.months[i - 40].date : sim.months[yrIdx[i - 51]].date;
  const d29d = sim.days[29].date, dYd = sim.months[10].date;
  const xOfDate = dt => { const dd = between(TODAY, dt); if (dd < -10) return null; if (dd < 0) return x0 + dd * L.pxPast; if (dd <= 29) return x0 + dd * L.pxDay;
    if (dt <= dYd) return x29 + between(d29d, dt) / between(d29d, dYd) * 11 * L.pxMonth; if (dt <= lastM) return xY + between(dYd, dt) / between(dYd, lastM) * (yrs - 1) * pxYear; return null; };
  const yAt = x => { for (let i = 0; i < N - 1; i++) if (x >= xs[i] && x <= xs[i + 1]) { const t = (x - xs[i]) / (xs[i + 1] - xs[i]); return Y(sv[i] + (sv[i + 1] - sv[i]) * t); } return x < xs[0] ? sp[0][1] : sp[N - 1][1]; };
  const vw = c._vw || 1200;
  const segs = [{ label: 'Last 10 days', sub: 'what happened', x: L.padL }, { label: 'Next 30 days', sub: 'day by day', x: x0 }, { label: 'The year ahead', sub: 'month by month', x: x29 }];
  if (yrs > 1) segs.push({ label: 'The long run', sub: 'year by year', x: xY });
  const breaks = [{ x: x29, label: 'ZOOMING OUT' }].concat(yrs > 1 ? [{ x: xY, label: 'ZOOMING OUT MORE' }] : []);
  const ticks = [];
  hist.forEach((d, i) => { if (i % 3 === 0 && i > 0 && i < 9) ticks.push({ x: X(i), label: fDay(d.date) }); });
  sim.days.forEach((d, i) => { if (i % 3 === 0 && i > 0 && i < 29) ticks.push({ x: X(10 + i), label: fDay(d.date) }); });
  sim.months.slice(0, 11).forEach((m, i) => ticks.push({ x: X(40 + i), label: (D(m.date).getUTCMonth() === 0 ? MON[0] + ' ’27' : MON[D(m.date).getUTCMonth()]) }));
  const ystep = pxYear >= 110 ? 1 : pxYear >= 60 ? 2 : 5;
  yrIdx.forEach((mi, k) => { if ((k + 1) % ystep === 0 || k === yrIdx.length - 1) ticks.push({ x: X(51 + k), label: String(D(sim.months[mi].date).getUTCFullYear()) }); });
  const axisMoney = v => (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toLocaleString('en-US') + 'k' : Math.abs(v));
  const minV = Math.min.apply(null, sv);
  const yt = [0]; let lastY = Y(0);
  if (minV < -60) yt.unshift(-250);
  const cands = []; for (let e = 1; e <= 6; e++) [1, 2, 5].forEach(k => cands.push(k * Math.pow(10, e)));
  cands.filter(v => v <= dmax * 1.05).forEach(v => { const y = Y(v); if (lastY - y >= 24 && y >= L.chartTop - 2) { yt.push(v); lastY = y; } });
  const grid = yt.map(v => ({ y: Y(v), label: axisMoney(v), zero: v === 0 }));
  const evTone = k => ({ pay: 'good', bill: 'muted', debt: 'muted', goal: 'info', extra: 'accent' })[k] || 'muted';
  const pins = [];
  hist.forEach((d, i) => d.ev.forEach(e => pins.push({ x: X(i), y: Y(d.low), label: e.label, amt: smoney(e.amt), tone: T(evTone(e.k)) })));
  sim.days.forEach((d, i) => { const evs = d.ev.filter(e => !(i === 0 && e.k === 'bill')); const goalEv = evs.filter(e => e.k === 'goal' || e.k === 'debt');
    evs.filter(e => e.k !== 'goal' && e.k !== 'debt').forEach(e => pins.push({ x: X(10 + i), y: Y(d.low), label: e.label, amt: smoney(e.amt), tone: T(evTone(e.k)) }));
    if (goalEv.length === 1) pins.push({ x: X(10 + i), y: Y(d.low), label: goalEv[0].label, amt: smoney(goalEv[0].amt), tone: T(evTone(goalEv[0].k)) });
    else if (goalEv.length > 1) pins.push({ x: X(10 + i), y: Y(d.low), label: goalEv.length + (goalEv[0].k === 'goal' ? ' goals' : ' debts'), amt: smoney(goalEv.reduce((a, e) => a + e.amt, 0)), tone: T(evTone(goalEv[0].k)) }); });
  for (let i = pins.length - 1; i >= 0; i--) if (/^[−+]\$0$/.test(pins[i].amt)) pins.splice(i, 1);
  pins.sort((a, b) => a.x - b.x); let lastPin = { x: -1e9, up: 1 };
  pins.forEach(p => { p.up = p.x - lastPin.x < 110 && lastPin.up === 0 ? 1 : 0; lastPin = p; p.ty = p.y - 40 - p.up * 30; p.lineH = 34 + p.up * 30; p.lineTop = p.y - p.lineH; });
  const lowX = X(10 + sim.li), lowY = Y(sim.lowest);
  // goal flags + cards
  const goalColor = g => TYPES[g.type].c;
  const flags = [];
  sim.goals.forEach(g => { const r = sim.goalMap[g.id]; const gx = r.date ? xOfDate(r.date) : null; if (gx !== null) flags.push({ id: g.id, x: gx, y: yAt(gx), label: g.name + (g.kind === 'save' ? ' reached' : ' paid off'), sub: fMonth(r.date), tone: T(goalColor(g)) }); });
  flags.sort((a, b) => a.x - b.x); let lf = { x: -1e9, up: 1 }; flags.forEach(fl => { fl.up = fl.x - lf.x < 230 && lf.up === 0 ? 1 : 0; lf = fl; fl.h = 56 + fl.up * 30; });
  const hubW = L.hubW || 340, gw = L.goalW || 300, yearW = L.yearW || 400, cgap = 24;
  const hubLeft = x29 + 36;
  const items = sim.goals.map(g => { const fl = flags.find(x => x.id === g.id); return { k: g.id, w: gw, want: (fl ? fl.x : xEnd) - gw / 2 }; });
  items.push({ k: 'year', w: yearW, want: xY - yearW / 2 });
  items.sort((a, b) => a.want - b.want);
  let cur = hubLeft + hubW + cgap; items.forEach(it => { it.left = Math.max(Math.min(it.want, xEnd - it.w), cur); cur = it.left + it.w + cgap; });
  const cardL = Object.fromEntries(items.map(it => [it.k, Math.round(it.left)]));
  const contentEnd = Math.max(xEnd + (L.padR || 130), cur + 60);
  const conn = (ax, ay, bx, by) => 'M' + ax + ',' + ay + ' C' + ax + ',' + (ay - 50) + ' ' + bx + ',' + (by + 60) + ' ' + bx + ',' + by;
  const A = Object.assign({}, L.anchors);
  const cn = { low: conn(A.low || 0, L.cardsTop, lowX, lowY + 8), stand: conn(A.stand || 0, L.cardsTop, x0, Y(sv[10]) + 8) };
  // Kip position (submerged)
  const kx = s.hover !== null && s.hover < N ? xs[s.hover] : Math.min(xs[N - 1] - 30, Math.max(xs[0] + 30, s.scrollX + vw * 0.34));
  const ky = s.hover !== null && s.hover < N ? sp[s.hover][1] : yAt(kx);
  const kc = Math.min(ky + 17, bottom - 18);
  if (c._kx !== undefined) { if (kx < c._kx - 3) c._flip = true; else if (kx > c._kx + 3) c._flip = false; } c._kx = kx;
  const hi = s.hover !== null && s.hover < N ? s.hover : null;
  const hov = hi === null ? { show: false } : (() => { const d = dateOf(hi); const evs = hi < 10 ? hist[hi].ev : hi < 40 ? sim.days[hi - 10].ev : [];
    return { show: true, x: xs[hi], y: sp[hi][1], date: hi === 10 ? 'Today' : hi < 40 ? fDay(d) : fMonth(d), bal: money(sv[hi]), what: hi >= 40 ? 'checking' : 'lowest that day', ev: evs.map(e => e.label + ' ' + smoney(e.amt)).join(' · '), hasEv: evs.length > 0 }; })();
  const jumps = [{ label: 'Now', x: 0 }, { label: 'Next 30 days', x: Math.round(x0 + 9 * L.pxDay - 120) }, { label: 'Goals', x: Math.round(x29 - 100) }];
  if (yrs > 1) jumps.push({ label: 'Long run', x: Math.round(Math.min(xY + 100, contentEnd - vw)) });
  let ja = 0; jumps.forEach((j, i) => { if (s.scrollX >= j.x - 60) ja = i; });

  /* top metrics */
  const AN = animNum(React);
  const num = (v, fm) => h(AN, { value: Math.round(v), fmt: fm || money });
  let next = null; sim.goals.forEach(g => { const r = sim.goalMap[g.id]; if (r.date && (!next || r.date < next.r.date)) next = { g, r }; });
  const nextPlan = next ? plan.goalMap[next.g.id] : null;
  const metrics = [
    { label: 'Lowest ahead', term: 'lowest', valEl: num(sim.lowest), sub: fDay(sim.lowestDate), d: moneyDelta(plan.lowest, sim.lowest), tone: T(sim.gap < 0 ? 'bad' : sim.gap < 100 ? 'warn' : 'good') },
    { label: 'Net worth in a year', term: 'networth12', valEl: num(sim.nw12), sub: 'now ' + money(sim.nwNow), d: moneyDelta(plan.nw12, sim.nw12), tone: T('ink') },
    { label: 'Next goal', term: 'nextgoal', valEl: next ? fMonth(next.r.date) : 'None on track', sub: next ? next.g.name : 'Add one with Kip', d: next ? durDelta(nextPlan.months, next.r.months) : durDelta(0, 0), tone: T('ink') },
    { label: 'Debt-free', term: 'debtfree', valEl: sim.debtFree ? fMonth(sim.debtFree) : 'Never', sub: money(sim.goals.filter(g => g.kind === 'payoff').reduce((a, g) => a + g.balance, 0) - planned.reduce((a, e) => a + e.amount, 0)) + ' owed', d: durDelta(plan.debtFreeMonths, sim.debtFreeMonths), tone: T('ink') },
  ].map(m => Object.assign(m, { dText: m.d.text, dTone: T(m.d.tone), dShow: m.d.show, dBg: T(m.d.tone + '-soft'), subShow: !m.d.show }));

  /* cards */
  const findings = [];
  if (sim.lowest < 0) findings.push(['bad', 'Heads up', 'Checking drops below zero on ' + fDay(sim.lowestDate) + '.']);
  else if (sim.gap < 0) findings.push(['bad', 'Heads up', 'Checking dips under your safety cushion on ' + fDay(sim.lowestDate) + '.']);
  else if (sim.gap < 100) findings.push(['warn', 'Watch', 'Checking gets within ' + money(sim.gap) + ' of your cushion on ' + fDay(sim.lowestDate) + '.']);
  if (sim.leftover < 0) findings.push(['bad', 'Heads up', 'Your plan spends ' + money(-sim.leftover) + ' a month more than comes in.']);
  if (sim.cov < 3) findings.push(['warn', 'Watch', 'Emergency savings cover about ' + fmtDur(sim.cov) + ' of essential bills.']);
  if (sim.debtMonths === null || sim.debtMonths > 36) findings.push(['warn', 'Watch', 'At ' + money(P.minPay + sim.effExtra) + ' a month, your card ' + (sim.debtDate ? 'takes until ' + fMonth(sim.debtDate) + ' to clear.' : 'never clears.')]);
  if (sim.leftover > 150) findings.push(['info', 'Idea', money(sim.leftover) + ' a month isn’t assigned to anything yet.']);
  const stand = { checking: money(P.checking), savings: money(P.savings), owe: money(sim.owe), nw: money(sim.nwNow), nwTone: T(sim.nwNow < 0 ? 'bad' : 'ink'), cov: fmtDur(sim.cov), lowest: money(sim.lowest), lowestDate: fDay(sim.lowestDate), lowTone: T(sim.gap < 0 ? 'bad' : sim.gap < 100 ? 'warn' : 'good'),
    findings: findings.slice(0, 3).map(x => ({ kind: x[1], text: x[2], dot: T(x[0]), bg: T(x[0] + '-soft') })) };
  const lowTone = sim.gap < 0 ? 'bad' : sim.gap < 100 ? 'warn' : 'good';
  const low = { value: money(sim.lowest), date: fDay(sim.lowestDate), gap: sim.gap >= 0 ? money(sim.gap) + ' above your cushion' : money(-sim.gap) + ' below your cushion', tone: T(lowTone), toneSoft: T(lowTone + '-soft'),
    title: sim.lowest < 0 ? 'Below zero' : sim.gap < 0 ? 'Under the cushion' : sim.gap < 100 ? 'Shallow water' : 'Plenty of water',
    why: sim.li >= 7 && sim.li <= 8 ? 'Rent and utilities land before your Nov 14 paycheck. Money out is counted before money in.' : 'The lowest point in the next 30 days, after listed bills, habits and goals.' };
  const pr = s.pay;
  const pay = { amount: pr.amount, chips: PAY_DATES.map((d, i) => ({ label: d.label, sub: d.sub, active: i === pr.dateIdx, onClick: H.payDate(i), bg: i === pr.dateIdx ? T('ink') : 'transparent', fg: i === pr.dateIdx ? T('bg') : T('ink'), bd: i === pr.dateIdx ? T('ink') : T('line') })),
    rows: payFacts.map(r => ({ label: r[0], before: r[1], after: r[2] })), hasRows: payFacts.length > 0,
    idle: pr.phase === 'idle', reviewing: pr.phase === 'reviewing', done: pr.phase === 'done',
    steps: stepRows(payStepsRaw.map(x => x.slice(0, 3)), pr.phase === 'reviewing' ? pr.step : undefined),
    ok: payOk, verdict: payOk ? 'Looks safe' : 'Not recommended', vTone: T(payOk ? 'good' : 'bad'), vBg: T(payOk ? 'good-soft' : 'bad-soft'),
    summary: !prev ? '' : payOk ? 'Checking stays at least ' + money(prev.lowest) + '. You’d owe ' + money(prev.owe) + ' and be card-free ' + (prev.debtDate ? 'by ' + fMonth(prev.debtDate) : 'eventually') + '.' : 'Checking would drop to ' + money(prev.lowest) + ' on ' + fDay(prev.lowestDate) + ', under your ' + money(P.cushion) + ' cushion.',
    hasSafer: !!safer, safer: safer ? safer.label : '', canReview: pAmt > 0,
    planned: s.planned.map(p => ({ id: p.id, label: money(p.amount) + ' on ' + fDay(p.date), remove: H.removePlanned(p.id) })), hasPlanned: s.planned.length > 0 };
  const upcoming = []; sim.days.forEach((d, i) => d.ev.forEach(e => { if (!(i === 0 && e.k === 'bill')) if (Math.round(e.amt) !== 0) upcoming.push({ date: fDay(d.date), label: e.label, amt: smoney(e.amt), tone: T(e.amt > 0 ? 'good' : 'ink'), after: money(d.bal) }); }));
  const spendRows = LEVERS.filter(l => l.kind === 'spend').map(l => ({ label: l.label, plan: money(s.plan[l.id]), sim: money(s.lv[l.id]), pPlan: (s.plan[l.id] / 600 * 100).toFixed(1) + '%', pSim: (s.lv[l.id] / 600 * 100).toFixed(1) + '%', dText: s.lv[l.id] === s.plan[l.id] ? '' : smoney(s.lv[l.id] - s.plan[l.id]), dTone: T(s.lv[l.id] < s.plan[l.id] ? 'good' : 'bad') }));
  const spend = { rows: spendRows, total: money(sim.disc + s.lv.subs), income: money(P.income + s.lv.side), essentials: money(sim.essentials), leftover: money(sim.leftover), leftoverTone: T(sim.leftover < 0 ? 'bad' : 'ink') };
  // goal cards
  const gr = s.goalRev; c._goalResult = {};
  const goalCards = sim.goals.map(g => {
    const r = sim.goalMap[g.id], rp = plan.goalMap[g.id]; const col = goalColor(g); const m = sim.gs.find(x => x.g.id === g.id).m; const mp = plan.gs.find(x => x.g.id === g.id).m;
    const baseM = goalMonthly(g, s.lv, false), planBase = goalMonthly(g, s.plan, true);
    const chg = Math.round(baseM) !== Math.round(planBase);
    const ok = sim.leftover >= 0 && sim.lowest >= P.cushion;
    const dd = durDelta(rp.months, r.months);
    const facts = [['Monthly', money(planBase), money(baseM)], [g.kind === 'save' ? 'Reached in' : 'Paid off in', fmtDur(rp.months), fmtDur(r.months)], ['Unassigned each month', money(plan.leftover), money(sim.leftover)]];
    const stepsRaw = [['Financial engine', 'CODE', 'Recalculated this goal and your monthly budget.'], ['Verifier', 'CODE', ok ? 'Fits your budget and keeps your cushion. Passed.' : sim.leftover < 0 ? 'Over budget by ' + money(-sim.leftover) + ' a month. Blocked.' : 'Would dip under your cushion. Blocked.'], ['Coach', 'AI', 'Summarized the change with verified figures.']];
    c._goalResult[g.id] = { name: g.name, from: money(planBase), to: money(baseM), facts, stepsRaw };
    const mine = gr.id === g.id;
    const isSave = g.kind === 'save';
    const pct = isSave ? Math.min(100, g.saved / g.target * 100) : 0;
    const late = isSave && g.deadline && r.date && r.date > g.deadline;
    const note = g.type === 'mortgage' ? 'Replaces your ' + money(P.rent) + ' rent. Not counted in net worth.' : isSave && g.deadline ? (r.date ? (late ? 'Target ' + fMonth(g.deadline) + ': late by ' + fmtDur(between(g.deadline, r.date) / 30) + '.' : 'Target ' + fMonth(g.deadline) + ': on track.') : 'Target ' + fMonth(g.deadline) + '.') : g.id === 'card' ? 'Minimum ' + money(P.minPay) + ' plus extra. Try the extra-payment card too.' : g.id === 'emergency' ? 'Goal: about ' + fmtDur(g.target / sim.essentials) + ' of essential bills.' : '';
    return { id: g.id, left: cardL[g.id], color: T(col), colorSoft: T(col + '-soft'), typeLabel: TYPES[g.type].label.toUpperCase(), name: g.name, isSave, isPayoff: !isSave,
      bigDate: r.date ? fMonth(r.date) : 'Never', verb: isSave ? 'Reached' : 'Paid off', dShow: dd.show, d: dd.text, dTone: T(dd.tone),
      pct: (isSave ? pct : 0).toFixed(1) + '%', progressText: isSave ? money(g.saved) + ' of ' + money(g.target) + ' saved' : money(r.owe !== undefined ? r.owe : g.balance) + ' owed · ' + g.apr + '% APR',
      monthly: money(m), duration: fmtDur(r.months), third: isSave ? money(Math.max(0, g.target - g.saved)) : r.interest === null ? '—' : money(r.interest), thirdLabel: isSave ? 'Still to save' : 'Total interest',
      hasRouted: s.route === g.id && sim.freed > 0, routed: '+' + money(Math.max(0, sim.freed)) + ' freed up',
      down: H.bump(g.id, -25), up: H.bump(g.id, 25), removable: !g.fixed, remove: H.removeGoal(g.id), note, hasNote: !!note,
      changed: chg, idle: !mine || gr.phase === 'idle', reviewing: mine && gr.phase === 'reviewing', done: mine && gr.phase === 'done', showReview: chg && (!mine || gr.phase === 'idle'),
      review: H.goalReview(g.id), approve: H.goalApprove(g.id), cancel: H.goalCancel, ok, verdict: ok ? 'Looks good' : 'Over budget', vTone: T(ok ? 'good' : 'bad'), vBg: T(ok ? 'good-soft' : 'bad-soft'),
      steps: stepRows(stepsRaw, mine && gr.phase === 'reviewing' ? gr.step : undefined), showNote: !!note && !(mine && gr.phase !== 'idle') };
  });
  const hubGoals = goalCards.map(gc => ({ name: gc.name, date: gc.bigDate, color: gc.color, verb: gc.verb, onClick: H.jump(Math.max(0, gc.left - 200)) }));
  const lr = s.lockRev; const nd = moneyDelta(plan.nw12, sim.nw12);
  const year = { left: cardL.year, nwNow: money(sim.nwNow), nw12: money(sim.nw12), d: nd.text, dTone: T(nd.tone), dShow: nd.show, cov12: fmtDur(sim.cov12), sav12: money(sim.sav12), changed, showHint: lr.phase === 'idle' && !changed, idle: lr.phase === 'idle', reviewing: lr.phase === 'reviewing', done: lr.phase === 'done', ok: lockOk,
    verdict: lockOk ? 'Looks good' : 'Not recommended', vTone: T(lockOk ? 'good' : 'bad'), vBg: T(lockOk ? 'good-soft' : 'bad-soft'), rows: lockFacts.map(r => ({ label: r[0], before: r[1], after: r[2] })), steps: stepRows(lockStepsRaw, lr.phase === 'reviewing' ? lr.step : undefined) };

  /* dock */
  const levers = LEVERS.map(l => { const v = s.lv[l.id], b = s.plan[l.id], d = v - b; const good = l.kind === 'spend' ? d < 0 : d > 0;
    return { id: l.id, label: l.label, value: v, valueLabel: money(v), min: l.min, max: l.max, step: l.step, onChange: H.lever(l.id), pct: ((v - l.min) / (l.max - l.min) * 100).toFixed(2) + '%', basePct: ((b - l.min) / (l.max - l.min) * 100).toFixed(2) + '%',
      dShow: d !== 0, dText: smoney(d), dTone: T(good ? 'good' : 'bad'), dBg: T(good ? 'good-soft' : 'bad-soft'), kind: l.kind, fill: T(d === 0 ? 'ink' : good ? 'good' : 'bad') }; });
  const routeOpts = sim.goals.map(g => ({ value: g.id, label: g.name, selected: s.route === g.id })).concat([{ value: 'cash', label: 'Keep in checking', selected: s.route === 'cash' }]);
  const freed = { text: (sim.freed >= 0 ? '+' : '−') + money(Math.abs(sim.freed)) + '/mo', tone: T(sim.freed > 0 ? 'good' : sim.freed < 0 ? 'bad' : 'muted'), year: smoney(sim.freed * 12) + ' a year' };

  /* water decor */
  const bubbles = [], weeds = [], rays = [], pebbles = [];
  for (let i = 0, x = 70; x < xEnd; i++, x += 150 + (i * 53) % 90) bubbles.push({ x, s: 4 + (i * 7) % 7, dl: ((i * 0.77) % 5).toFixed(2) + 's', du: (4.5 + (i % 4) * 0.8).toFixed(1) + 's', top: bottom - 10 });
  for (let i = 0, x = 120; x < xEnd - 40; i++, x += 210 + (i * 71) % 160) { const n = 2 + (i % 3); for (let j = 0; j < n; j++) weeds.push({ x: x + j * 9, h: 26 + ((i * 17 + j * 23) % 34), dl: ((i * 0.6 + j * 0.4) % 3).toFixed(2) + 's', du: (3.2 + ((i + j) % 3) * 0.6).toFixed(1) + 's', top: bottom - (26 + ((i * 17 + j * 23) % 34)), c: j % 2 ? T('weed2') : T('weed') }); }
  for (let i = 0, x = 200; x < xEnd; i++, x += 460 + (i * 97) % 200) rays.push({ x, w: 46 + (i * 13) % 50, dl: ((i * 1.3) % 6).toFixed(1) + 's' });
  for (let i = 0, x = 60; x < xEnd; i++, x += 90 + (i * 41) % 120) pebbles.push({ x, w: 8 + (i * 5) % 10, h: 5 + (i * 3) % 4, top: bottom - 6 - (i * 3) % 4 });

  /* drawers */
  const chat = s.chat.map((m, i) => ({ isKip: m.role === 'kip', isUser: m.role === 'user', text: m.text, hasTrace: !!m.trace, open: s.traceOpen === i, toggle: H.trace(i), src: m.live === false ? 'Calculator only · AI unavailable' : 'AI answer · verified figures', steps: stepRows(chatTrace(m.live !== false)) }));
  const receipts = s.receipts.map(r => ({ id: r.id, when: r.when, title: r.title, verdict: r.verdict, vTone: T(r.tone), vBg: T(r.tone + '-soft'), kind: r.kind, onClick: H.openRec(r.id), active: s.openRec === r.id }));
  const rr = s.receipts.find(r => r.id === s.openRec);
  const rec = rr ? { title: rr.title, when: rr.when, kind: rr.kind, verdict: rr.verdict, vTone: T(rr.tone), vBg: T(rr.tone + '-soft'), facts: rr.facts.map(x => ({ label: x[0], before: x[1], after: x[2] })), checks: rr.checks.map(x => ({ label: x[0], mark: x[1] ? '✓' : '✕', tone: T(x[1] ? 'good' : 'bad') })), steps: stepRows(rr.steps), note: rr.note } : null;
  const field = (k, label, pre, suf) => ({ key: k, label, value: String(P[k]), onChange: H.prof(k), pre: pre || '', suf: suf || '' });
  const howObj = s.how ? HOW[s.how] : null;
  const tipG = s.tip ? GLOSSARY[s.tip.term] : null;
  const below = s.tip && s.tip.y < 190;
  return {
    ready: true, loading: false, theme: s.theme, knobX: s.theme === 'dark' ? 'translateX(28px)' : 'translateX(0px)', toggleTheme: H.toggleTheme, themeLabel: s.theme === 'dark' ? 'Light mode' : 'Dark mode', asOf: 'Nov 7, 2026',
    kipLogo: kip(React, { mood: sim.mood, size: 46 }), kipDock: kip(React, { mood: sim.mood, size: L.dockKip || 96 }), kipSwim: kip(React, { mood: sim.mood, size: 74, flip: !!c._flip, bubbles: true }), kipChat: kip(React, { mood: 'happy', size: 36, still: true }), kipHub: kip(React, { mood: sim.mood, size: 56 }),
    kipMood: 'Kip is ' + MOOD[sim.mood].label, kipLine: kipSays(s, sim, plan, P), mood: sim.mood,
    ripple: h('span', { key: s.ripple, style: { position: 'absolute', left: '50%', top: '50%', width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.8)', pointerEvents: 'none', animation: s.ripple ? 'koinRipple 1.1s ease-out forwards' : 'none', opacity: 0 } }),
    metrics, W: contentEnd, xEnd, x0, x29, chartTop: L.chartTop, chartBottom: bottom, chartH: L.chartH, stageH: L.stageH, lineW: xEnd - L.padL, waterClip: "path('" + areaD + "')",
    scrollRef: H.scrollRef, onScroll: H.onScroll, jumps: jumps.map((j, i) => ({ label: j.label, onClick: H.jump(j.x), active: i === ja, bg: i === ja ? T('ink') : 'transparent', fg: i === ja ? T('bg') : T('muted') })),
    segs, breaks, ticks, grid, lineD, areaD, planD: changed ? path(pts(pv)) : '', ghostD: prev && (s.payHover || pr.phase !== 'idle') ? path(pts(gv)) : '',
    cushionY: Y(P.cushion), zeroY: Y(0), cushionLabel: 'Safety cushion ' + money(P.cushion), todayX: x0, bottom, shallowsH: Math.max(0, bottom - Y(P.cushion)),
    bubbles, weeds, rays, pebbles,
    pins, lowX, lowY, lowLabel: 'Lowest ' + money(sim.lowest), lowTone: low.tone, flags, cn,
    chartMove: H.chartMove, chartLeave: H.chartLeave, hov, kipT: 'translate(' + (kx - 37).toFixed(1) + 'px,' + (kc - 21).toFixed(1) + 'px)',
    stand, low, pay, upcoming: upcoming.slice(0, 8), spend, goalCards, hubGoals, hubLeft, year,
    goalInput: s.goalText, setGoalInput: H.goalText, goalKey: H.goalKey, goalSend: H.goalSend, goalExamples: GOAL_EXAMPLES.map(([label, q]) => ({ text: label, onClick: H.ask(q) })),
    payReview: H.payReview, paySafer: H.paySafer, payApprove: H.payApprove, payCancel: H.payCancel, payAmount: H.payAmount, payEnter: H.payEnter, payLeave: H.payLeave,
    lockReview: H.lockReview, lockApprove: H.lockApprove, lockCancel: H.lockCancel, lockDock: H.lockDock(Math.max(0, Math.round(cardL.year + yearW - vw + 40))),
    levers, routeOpts, routeSel: H.routeSel, route: s.route, routeSelect: h('select', { value: s.route, onChange: H.routeSel, 'aria-label': 'Send freed-up cash to', style: { height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 11, background: 'var(--surface2)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit' } }, routeOpts.map(o => h('option', { key: o.value, value: o.value }, o.label))), freed, changed, reset: H.reset,
    drawerKip: s.drawer === 'kip', drawerReceipts: s.drawer === 'receipts', openKip: H.openKip, openReceipts: H.openReceipts, closeDrawer: H.closeDrawer,
    chat, chatRef: H.chatRef, chatInput: s.chatInput, setChatInput: H.chatInput, chatKey: H.chatKey, sendChat: H.send, chatBusy: s.chatBusy, kipLoader: kipLoader(React, s.chatStep, 'happy'), busy: (() => { const x = CHAT_STEPS[Math.min(4, s.chatStep)]; const [bg, fg] = STEP_TONE[x[1]]; return { agent: x[0], kind: x[1], kBg: T(bg), kFg: T(fg), text: x[2] + '…', who: x[1] === 'AI' ? 'AI agent' : 'code check' }; })(), busySteps: stepRows(chatTrace(aiAvailable()), s.chatStep), suggestions: (() => { const asked = new Set(s.chat.filter(m => m.role === 'user').map(m => m.text));
      const em = sim.goals.find(g => g.type === 'emergency') || sim.goals.find(g => g.kind === 'save');
      const qs = ['Why is ' + fDay(sim.lowestDate) + ' my lowest day?', 'Can I pay $300 on my card today?', 'Where is my money leaking?', 'When will I be debt-free?']
        .concat(em ? ['How long until my ' + em.name.toLowerCase() + ' is full?'] : [], ['What is a safety cushion?'], sim.goals.some(g => g.type === 'vacation') ? [] : ['Save $2,400 for a vacation by June'], ['Pay off $18,000 in student loans at 5%']);
      return qs.filter(q => !asked.has(q)).slice(0, s.chat.length < 3 ? 4 : 99).map(q => ({ text: q, onClick: H.ask(q) })); })(), showSuggest: !s.chatBusy, chipsRef: H.chipsRef, suggestWrap: s.chat.length < 3 ? 'wrap' : 'nowrap',
    receipts, receiptCount: String(s.receipts.length), rec, hasRec: !!rec, noRec: !rec, closeRec: H.closeRec,
    setupOpen: s.setup, openSetup: H.openSetup, closeSetup: H.closeSetup, stop: H.stop,
    fieldsMoney: [field('income', 'Take-home pay / month', '$'), field('rent', 'Rent', '$'), field('utilities', 'Utilities', '$'), field('cushion', 'Safety cushion', '$')],
    fieldsDebt: [field('owe', 'Card balance', '$'), field('apr', 'Card APR', '', '%'), field('minPay', 'Minimum payment', '$'), field('checking', 'Checking today', '$')],
    fieldsGoal: [field('goalName', 'Goal name'), field('goalTarget', 'Target', '$'), field('savings', 'Saved so far', '$')],
    howOpen: !!howObj, how: howObj ? { title: howObj.title, intro: howObj.intro, note: howObj.note, steps: howObj.steps.map((x, i) => { const [bg, fg] = STEP_TONE[x[0]]; return { n: i + 1, kind: x[0], title: x[1], text: x[2], kBg: T(bg), kFg: T(fg) }; }) } : null,
    closeHow: H.closeHow, howStand: H.how('stand'), howForecast: H.how('forecast'), howPay: H.how('pay'), howApprove: H.how('approve'), howKip: H.how('kip'), howGoals: H.how('goals'),
    tip: tipG ? { show: true, x: s.tip.x, y: below ? s.tip.b + 10 : s.tip.y - 10, tr: below ? 'translate(-50%,0)' : 'translate(-50%,-100%)', title: tipG[0], def: tipG[1] } : { show: false }, showTip: H.showTip, hideTip: H.hideTip,
    toast: s.toast ? { show: true, text: s.toast } : { show: false },
  };
}

window.KoinModel = { view, compute, LEVERS, PROFILE, money, fDay, fMonth, fmtDur, kip, parseGoal };
})();
