import {test} from 'node:test';import assert from 'node:assert/strict';import {fixture,simulate} from '../backend/finance.mjs';
test('baseline protects the declared floor',()=>assert.equal(simulate(fixture()).minCashCents,20000));
test('immediate payment is blocked',()=>{const r=simulate(fixture(),[{kind:'extra_debt_payment',date:'2026-11-07',amountCents:30000}]);assert.equal(r.minCashCents,-10000);assert.equal(r.policy,'blocked');});
test('deferred payment preserves floor',()=>assert.equal(simulate(fixture(),[{kind:'extra_debt_payment',date:'2026-11-15',amountCents:30000}]).minCashCents,20000));
test('reject invalid money and dates',()=>{for(const amountCents of [-1,1.5,NaN,Infinity])assert.throws(()=>simulate(fixture(),[{kind:'extra_debt_payment',date:'2026-11-07',amountCents}]));assert.throws(()=>simulate(fixture(),[{kind:'extra_debt_payment',date:'2026-11-31',amountCents:1}]));});
