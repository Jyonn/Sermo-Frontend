import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMoney,reimbursementCny,reimbursementTotal} from '../src/lib/researchReimbursement.ts';

test('FX quotes use 100-unit basis and exact half-up cents',()=>{
 assert.equal(reimbursementCny('12.34','CNY',''),'12.34');
 assert.equal(reimbursementCny('100.00','USD','712.34'),'712.34');
 assert.equal(reimbursementCny('1.00','USD','100.50'),'1.01');
 assert.equal(reimbursementCny('2000.00','JPY','4.75'),'95.00');
 assert.equal(normalizeMoney('12.3'),'12.30');
});
test('invalid precision and missing FX rates never produce a total',()=>{
 assert.equal(reimbursementCny('1.001','CNY',''),null);
 assert.equal(reimbursementCny('100','USD',''),null);
 assert.equal(reimbursementCny('100','USD','7.123'),null);
 assert.equal(reimbursementCny('-1','CNY',''),null);
 assert.equal(reimbursementTotal([{amount:'12.34',currency:'CNY',exchange_rate:''},{amount:'100',currency:'USD',exchange_rate:'712.34'}]),'724.68');
});
