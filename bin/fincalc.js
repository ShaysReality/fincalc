#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { stdin, stdout, stderr } from 'node:process';
import * as F from '../src/index.js';

const help = `
fincalc — finance formulas (CLI + library)

Usage:
  fincalc npv --rate 0.1 --cashflows -100,50,60
  fincalc irr --cashflows -100,40,40,40
  fincalc xirr --cashflows -100,40,40,40 --dates 2025-01-01,2025-04-01,2025-07-01,2025-10-01 --basis ACT/365
  fincalc payback --cashflows -100,30,40,50
  fincalc pi --rate 0.1 --cashflows -100,50,60
  fincalc annuity-pv --rate 0.08 --n 5 --pmt 100
  fincalc annuity-fv --rate 0.08 --n 5 --pmt 100
  fincalc bond-price --face 1000 --coupon 0.05 --yield 0.06 --n 10 --freq 2
  fincalc bond-yield --face 1000 --coupon 0.05 --price 950 --n 10 --freq 2
  fincalc duration --face 1000 --coupon 0.05 --yield 0.06 --n 10 --freq 2
  fincalc convexity --face 1000 --coupon 0.05 --yield 0.06 --n 10 --freq 2
  fincalc wacc --we 0.6 --wd 0.4 --re 0.12 --rd 0.07 --tax 0.21
  fincalc ddm-gordon --d1 2 --g 0.04 --r 0.09

Global options:
  --from <path>       Load inputs from .json or .csv (headers: cashflow,date)
  --round <n>         Round numeric outputs to n decimals
  --format <json|number>  Force output format (default auto)
  --basis <ACT/365|ACT/360|30E/360>  (for xnpv/xirr; default ACT/365)
  -h, --help
`;

function parseCSVList(s) {
  if (!s) return [];
  return s.split(',').map(x => x.trim()).filter(Boolean);
}
function toNums(arr) {
  return arr.map(x => {
    const v = Number(x);
    if (!Number.isFinite(v)) throw new Error(`Not a number: ${x}`);
    return v;
  });
}

// minimal CSV reader for --from .csv (cashflow,date)
function parseCSVLoose(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return {};
  const headers = lines[0].split(',').map(s => s.trim().toLowerCase());
  const idxCf = headers.indexOf('cashflow');
  const idxDt = headers.indexOf('date');
  const cf = [], dt = [];
  for (const r of lines.slice(1)) {
    const cols = r.split(',').map(s => s.trim());
    if (idxCf >= 0 && cols[idxCf] !== '') cf.push(Number(cols[idxCf]));
    if (idxDt >= 0 && cols[idxDt]) dt.push(cols[idxDt]);
  }
  return { cashflows: cf.length ? cf : undefined, dates: dt.length ? dt : undefined };
}
function loadFrom(path) {
  const text = readFileSync(path, 'utf8');
  if (/\.json$/i.test(path)) return JSON.parse(text);
  if (/\.csv$/i.test(path)) return parseCSVLoose(text);
  throw new Error('Unsupported file type; use .json or .csv');
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') args.help = true;
    else if (!a.startsWith('--')) args._.push(a);
    else {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

function roundMaybe(val, n) {
  if (!Number.isFinite(n)) return val;
  if (typeof val === 'number') return Number(val.toFixed(n));
  return val;
}

function print(val, { round, format }) {
  const out = roundMaybe(val, Number.isFinite(+round) ? +round : undefined);
  if (format === 'json') {
    stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else if (format === 'number' && typeof out === 'number') {
    stdout.write(String(out) + '\n');
  } else {
    if (typeof out === 'number') stdout.write(String(out) + '\n');
    else stdout.write(JSON.stringify(out, null, 2) + '\n');
  }
}

async function readAllStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', chunk => data += chunk);
    stdin.on('end', () => resolve(data.trim()));
    stdin.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args._[0]) {
    stdout.write(help);
    return;
  }
  const cmd = args._[0];
  const fileData = args.from ? loadFrom(args.from) : {};

  try {
    switch (cmd) {
      case 'npv': {
        const rate = Number(args.rate ?? fileData.rate);
        const c = toNums(parseCSVList(args.cashflows ?? (fileData.cashflows ?? []).join(',')));
        print(F.npv(rate, c), { round: args.round, format: args.format });
        break;
      }
      case 'irr': {
        const c = toNums(parseCSVList(args.cashflows ?? (fileData.cashflows ?? []).join(',')));
        print(F.irr(c), { round: args.round, format: args.format });
        break;
      }
      case 'xirr': {
        const c = toNums(parseCSVList(args.cashflows ?? (fileData.cashflows ?? []).join(',')));
        const dates = parseCSVList(args.dates ?? (fileData.dates ?? []).join(','));
        const basis = (args.basis ?? fileData.basis ?? 'ACT/365').toUpperCase();
        print(F.xirr(c, dates, Number(args.guess ?? 0.1), { basis }), { round: args.round, format: args.format });
        break;
      }
      case 'payback': {
        const c = toNums(parseCSVList(args.cashflows ?? (fileData.cashflows ?? []).join(',')));
        print(F.paybackPeriod(c), { round: args.round, format: args.format });
        break;
      }
      case 'pi': {
        const rate = Number(args.rate ?? fileData.rate);
        const c = toNums(parseCSVList(args.cashflows ?? (fileData.cashflows ?? []).join(',')));
        print(F.profitabilityIndex(rate, c), { round: args.round, format: args.format });
        break;
      }
      case 'annuity-pv': {
        const r = Number(args.rate ?? fileData.rate), n = Number(args.n ?? fileData.n), pmt = Number(args.pmt ?? fileData.pmt);
        print(F.annuityPV(r, n, pmt), { round: args.round, format: args.format });
        break;
      }
      case 'annuity-fv': {
        const r = Number(args.rate ?? fileData.rate), n = Number(args.n ?? fileData.n), pmt = Number(args.pmt ?? fileData.pmt);
        print(F.annuityFV(r, n, pmt), { round: args.round, format: args.format });
        break;
      }
      case 'bond-price': {
        const face = Number(args.face ?? fileData.face), coupon = Number(args.coupon ?? fileData.coupon), y = Number(args.yield ?? fileData.yield);
        const n = Number(args.n ?? fileData.n), freq = Number((args.freq ?? fileData.freq) || 1);
        print(F.bondPrice(face, coupon, y, n, freq), { round: args.round, format: args.format });
        break;
      }
      case 'bond-yield': {
        const face = Number(args.face ?? fileData.face), coupon = Number(args.coupon ?? fileData.coupon), price = Number(args.price ?? fileData.price);
        const n = Number(args.n ?? fileData.n), freq = Number((args.freq ?? fileData.freq) || 1);
        print(F.bondYield(face, coupon, price, n, freq), { round: args.round, format: args.format });
        break;
      }
      case 'duration': {
        const face = Number(args.face ?? fileData.face), coupon = Number(args.coupon ?? fileData.coupon), y = Number(args.yield ?? fileData.yield);
        const n = Number(args.n ?? fileData.n), freq = Number((args.freq ?? fileData.freq) || 1);
        print(F.macaulayDuration(face, coupon, y, n, freq), { round: args.round, format: args.format });
        break;
      }
      case 'convexity': {
        const face = Number(args.face ?? fileData.face), coupon = Number(args.coupon ?? fileData.coupon), y = Number(args.yield ?? fileData.yield);
        const n = Number(args.n ?? fileData.n), freq = Number((args.freq ?? fileData.freq) || 1);
        print(F.convexity(face, coupon, y, n, freq), { round: args.round, format: args.format });
        break;
      }
      case 'wacc': {
        const we = Number(args.we ?? fileData.we), wd = Number(args.wd ?? fileData.wd), re = Number(args.re ?? fileData.re), rd = Number(args.rd ?? fileData.rd), tax = Number(args.tax ?? fileData.tax);
        print(F.wacc({ we, wd, re, rd, tax }), { round: args.round, format: args.format });
        break;
      }
      case 'ddm-gordon': {
        const d1 = Number(args.d1 ?? fileData.d1), g = Number(args.g ?? fileData.g), r = Number(args.r ?? fileData.r);
        print(F.ddmGordon(d1, g, r), { round: args.round, format: args.format });
        break;
      }
      default:
        stdout.write(help);
    }
  } catch (e) {
    stderr.write('Error: ' + (e && e.message ? e.message : String(e)) + '\n');
    process.exit(1);
  }
}

main();
