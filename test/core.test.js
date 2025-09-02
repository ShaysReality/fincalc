import test from 'node:test';
import assert from 'node:assert/strict';
import {
  npv, irr, xnpv, xirr,
  bondPrice, macaulayDuration
} from '../src/index.js';

test('npv basic', () => {
  const val = npv(0.1, [-100, 50, 60]);
  const expected = -100 + 50 / 1.1 + 60 / 1.21;
  assert.ok(Math.abs(val - expected) < 1e-12);
});

test('irr simple', () => {
  const r = irr([-100, 60, 60]);
  assert.ok(r > 0.1 && r < 0.2);
});

test('xnpv basis ACT/365', () => {
  const cf = [-100, 110];
  const dates = ['2025-01-01', '2026-01-01'];
  const v = xnpv(0.1, cf, dates, { basis: 'ACT/365' });
  assert.ok(v > 0);
});

test('xirr with basis', () => {
  const cf = [-100, 50, 60];
  const dates = ['2025-01-01', '2025-06-01', '2025-12-31'];
  const r = xirr(cf, dates, 0.1, { basis: 'ACT/365' });
  assert.ok(Number.isFinite(r));
});

test('bond price & duration ballpark', () => {
  const p = bondPrice(1000, 0.05, 0.06, 10, 2);
  assert.ok(p > 900 && p < 1000);
  const d = macaulayDuration(1000, 0.05, 0.06, 10, 2);
  assert.ok(d > 6 && d < 9);
});
