// Core finance math utilities (no I/O)

export function npv(rate, cashflows) {
  if (!Number.isFinite(rate)) throw new Error('Invalid rate');
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

export function irr(cashflows, guess = 0.1) {
  const f = r => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  const df = r => cashflows.reduce((acc, cf, t) => acc + (t ? -t * cf / Math.pow(1 + r, t + 1) : 0), 0);

  let r = guess;
  for (let i = 0; i < 50; i++) {
    const y = f(r), dy = df(r);
    if (Math.abs(y) < 1e-10) return r;
    if (dy === 0 || !Number.isFinite(dy)) break;
    const r1 = r - y / dy;
    if (!Number.isFinite(r1) || r1 <= -0.999999) break;
    r = r1;
  }

  let lo = -0.9, hi = 10.0;
  let flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) throw new Error('IRR not bracketed; check cashflows');
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-10) return mid;
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// --- v0.2.0: day-count basis support for XNPV/XIRR ---
function yearFrac(d0, d1, basis = 'ACT/365') {
  const D0 = new Date(d0), D1 = new Date(d1);
  if (Number.isNaN(D0) || Number.isNaN(D1)) throw new Error('Invalid date');
  if (basis === 'ACT/365') return (D1 - D0) / (1000 * 60 * 60 * 24 * 365);
  if (basis === 'ACT/360') return (D1 - D0) / (1000 * 60 * 60 * 24 * 360);
  if (basis === '30E/360') {
    const y0 = D0.getUTCFullYear(), m0 = D0.getUTCMonth() + 1, d0e = Math.min(D0.getUTCDate(), 30);
    const y1 = D1.getUTCFullYear(), m1 = D1.getUTCMonth() + 1, d1e = Math.min(D1.getUTCDate(), 30);
    return ((360 * (y1 - y0)) + 30 * (m1 - m0) + (d1e - d0e)) / 360;
  }
  throw new Error('Unsupported basis');
}

export function xnpv(rate, cashflows, dates, { basis = 'ACT/365' } = {}) {
  if (cashflows.length !== dates.length) throw new Error('cashflows and dates length mismatch');
  const t0 = dates[0];
  return cashflows.reduce((acc, cf, i) =>
    acc + cf / Math.pow(1 + rate, yearFrac(t0, dates[i], basis)), 0);
}

export function xirr(cashflows, dates, guess = 0.1, { basis = 'ACT/365' } = {}) {
  const f = r => xnpv(r, cashflows, dates, { basis });
  const df = r => { const h = 1e-6; return (f(r + h) - f(r - h)) / (2 * h); };

  let r = guess;
  for (let i = 0; i < 50; i++) {
    const y = f(r), dy = df(r);
    if (Math.abs(y) < 1e-8) return r;
    if (!Number.isFinite(dy) || dy === 0) break;
    const r1 = r - y / dy;
    if (!Number.isFinite(r1) || r1 <= -0.999999) break;
    r = r1;
  }

  let lo = -0.9, hi = 10.0, flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) throw new Error('XIRR not bracketed; check cashflows/dates');
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.abs(fm) < 1e-8) return mid;
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// --- other formulas ---
export function paybackPeriod(cashflows) {
  let cum = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prev = cum;
    cum += cashflows[t];
    if (cum >= 0) {
      const needed = -prev, within = cashflows[t];
      const frac = within !== 0 ? needed / within : 0;
      return t - 1 + frac;
    }
  }
  return Infinity;
}

export function profitabilityIndex(rate, cashflows) {
  const c0 = cashflows[0] || 0;
  const pv = npv(rate, cashflows.slice(1));
  return pv / Math.abs(c0);
}

export function annuityPV(rate, n, pmt) {
  if (rate === 0) return pmt * n;
  return pmt * (1 - Math.pow(1 + rate, -n)) / rate;
}
export function annuityFV(rate, n, pmt) {
  if (rate === 0) return pmt * n;
  return pmt * (Math.pow(1 + rate, n) - 1) / rate;
}

export function bondPrice(face, couponRate, yieldRate, years, freq = 1) {
  const c = (couponRate * face) / freq;
  const m = Math.round(years * freq);
  const y = yieldRate / freq;
  let pv = 0;
  for (let t = 1; t <= m; t++) pv += c / Math.pow(1 + y, t);
  pv += face / Math.pow(1 + y, m);
  return pv;
}

export function bondYield(face, couponRate, price, years, freq = 1) {
  const m = Math.round(years * freq);
  const c = (couponRate * face) / freq;
  const f = y => {
    let pv = 0;
    for (let t = 1; t <= m; t++) pv += c / Math.pow(1 + y, t);
    pv += face / Math.pow(1 + y, m);
    return pv - price;
  };
  let y = 0.05 / freq;
  for (let i = 0; i < 50; i++) {
    const h = 1e-6, fy = f(y);
    const dy = (f(y + h) - f(y - h)) / (2 * h);
    if (Math.abs(fy) < 1e-8) return y * freq;
    if (!Number.isFinite(dy) || dy === 0) break;
    const y1 = y - fy / dy;
    if (!Number.isFinite(y1) || y1 <= -0.999999) break;
    y = y1;
  }
  let lo = 0.000001, hi = 1.0, flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) throw new Error('Yield not bracketed');
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.abs(fm) < 1e-8) return mid * freq;
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return ((lo + hi) / 2) * freq;
}

export function macaulayDuration(face, couponRate, yieldRate, years, freq = 1) {
  const c = (couponRate * face) / freq;
  const m = Math.round(years * freq);
  const y = yieldRate / freq;
  let pvTotal = 0, tWeighted = 0;
  for (let t = 1; t <= m; t++) {
    const cf = t < m ? c : c + face;
    const disc = Math.pow(1 + y, t);
    const pv = cf / disc;
    pvTotal += pv;
    tWeighted += (t / freq) * pv;
  }
  return tWeighted / pvTotal;
}

export function convexity(face, couponRate, yieldRate, years, freq = 1) {
  const c = (couponRate * face) / freq;
  const m = Math.round(years * freq);
  const y = yieldRate / freq;
  let sum = 0;
  for (let t = 1; t <= m; t++) {
    const cf = t < m ? c : c + face;
    const disc = Math.pow(1 + y, t);
    sum += (cf * t * (t + 1)) / disc;
  }
  const price = bondPrice(face, couponRate, yieldRate, years, freq);
  return sum / (price * Math.pow(1 + y, 2) * Math.pow(freq, 2));
}

export function wacc({ we, wd, re, rd, tax }) {
  if (Math.abs(we + wd - 1) > 1e-8) throw new Error('Weights must sum to 1');
  return we * re + wd * rd * (1 - tax);
}

export function ddmGordon(D1, g, r) {
  if (r <= g) throw new Error('Required return must exceed growth');
  return D1 / (r - g);
}
