// Core finance math utilities (no I/O)

export function npv(rate, cashflows) {
  if (!Number.isFinite(rate)) throw new Error('Invalid rate');
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

export function irr(cashflows, guess = 0.1) {
  // Newton-Raphson with bisection fallback
  const f = r => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  const df = r => cashflows.reduce((acc, cf, t) => acc + (t ? -t * cf / Math.pow(1 + r, t + 1) : 0), 0);

  // Try Newton
  let r = guess;
  for (let i = 0; i < 50; i++) {
    const y = f(r), dy = df(r);
    if (Math.abs(y) < 1e-10) return r;
    if (dy === 0 || !Number.isFinite(dy)) break;
    const r1 = r - y / dy;
    if (!Number.isFinite(r1) || r1 <= -0.999999) break;
    r = r1;
  }

  // Bisection in [-0.9, 10]
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

function daysBetween(d0, d1) {
  const t0 = new Date(d0).getTime();
  const t1 = new Date(d1).getTime();
  return (t1 - t0) / (1000 * 60 * 60 * 24);
}

export function xnpv(rate, cashflows, dates) {
  // cashflows[i], dates[i] ISO strings
  if (cashflows.length !== dates.length) throw new Error('cashflows and dates length mismatch');
  const t0 = new Date(dates[0]);
  return cashflows.reduce((acc, cf, i) => {
    const di = new Date(dates[i]);
    const yearFrac = (di - t0) / (1000 * 60 * 60 * 24 * 365.0);
    return acc + cf / Math.pow(1 + rate, yearFrac);
  }, 0);
}

export function xirr(cashflows, dates, guess = 0.1) {
  const f = r => xnpv(r, cashflows, dates);
  // Numeric derivative
  const df = r => {
    const h = 1e-6;
    return (f(r + h) - f(r - h)) / (2 * h);
  };

  let r = guess;
  for (let i = 0; i < 50; i++) {
    const y = f(r), dy = df(r);
    if (Math.abs(y) < 1e-8) return r;
    if (!Number.isFinite(dy) || dy === 0) break;
    const r1 = r - y / dy;
    if (!Number.isFinite(r1) || r1 <= -0.999999) break;
    r = r1;
  }

  // Bisection fallback
  let lo = -0.9, hi = 10.0;
  let flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) throw new Error('XIRR not bracketed; check cashflows/dates');
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-8) return mid;
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

export function paybackPeriod(cashflows) {
  let cum = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prev = cum;
    cum += cashflows[t];
    if (cum >= 0) {
      const needed = -prev;
      const within = cashflows[t];
      const frac = within !== 0 ? needed / within : 0;
      return t - 1 + frac; // fractional periods
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

// Bond math (annualized coupon; freq payments per year)
export function bondPrice(face, couponRate, yieldRate, years, freq = 1) {
  const c = (couponRate * face) / freq;
  const m = Math.round(years * freq);
  const y = yieldRate / freq;
  let pv = 0;
  for (let t = 1; t <= m; t++) {
    pv += c / Math.pow(1 + y, t);
  }
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
  // Newton then bisection
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
  let lo = 0.000001, hi = 1.0;
  let flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) throw new Error('Yield not bracketed');
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-8) return mid * freq;
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return ((lo + hi) / 2) * freq;
}

// Macaulay Duration (in years)
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
    tWeighted += (t / freq) * pv; // convert to years
  }
  return tWeighted / pvTotal;
}

// Convexity (annualized)
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
