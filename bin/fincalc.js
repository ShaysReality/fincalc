#!/usr/bin/env node
import { stdin, stdout, stderr } from 'node:process';
import * as F from '../src/index.js';

const help = `
fincalc — finance formulas (CLI + library)

Usage:
  fincalc npv --rate 0.1 --cashflows -100,50,60
  fincalc irr --cashflows -100,40,40,40
  fincalc xirr --cashflows -100,40,40,40 --dates 2025-01-01,2025-04-01,2025-07-01,2025-10-01
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

Options:
  --cashflows <csv>  e.g. -100,50,60
  --dates <csv>      e.g. 2025-01-01,2025-06-01,...
  --rate <r>         Discount rate (decimal)
  --yield <y>        Yield to maturity (decimal)
  --price <p>        Price
  --face <F>         Face value
  --coupon <c>       Coupon rate (decimal, annualized)
  --n <n>            Periods (years for bonds)
  --freq <m>         Coupon payments per year (default 1)
  --pmt <pmt>        Payment per period
  --we, --wd         Equity / debt weights
  --re, --rd         Cost of equity / cost of debt
  --tax <t>          Tax rate
  --d1 <d1>, --g <g>, --r <r>  Gordon growth vars
  -h, --help
`;

function parseCSV(s) {
  if (!s) return [];
  return s.split(',').map(x => x.trim());
}

function toNums(arr) {
  return arr.map(x => {
    const v = Number(x);
    if (!Number.isFinite(v)) throw new Error(`Not a number: ${x}`);
    return v;
  });
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

async function readAllStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', chunk => data += chunk);
    stdin.on('end', () => resolve(data.trim()));
    stdin.on('error', reject);
  });
}

function print(val) {
  if (typeof val === 'number') {
    stdout.write(String(val) + '\n');
  } else {
    stdout.write(JSON.stringify(val, null, 2) + '\n');
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args._[0]) {
    stdout.write(help);
    return;
  }

  const cmd = args._[0];

  try {
    switch (cmd) {
      case 'npv': {
        const rate = Number(args.rate);
        const c = toNums(parseCSV(args.cashflows));
        print(F.npv(rate, c));
        break;
      }
      case 'irr': {
        const c = toNums(parseCSV(args.cashflows));
        print(F.irr(c));
        break;
      }
      case 'xirr': {
        const c = toNums(parseCSV(args.cashflows));
        const dates = parseCSV(args.dates);
        print(F.xirr(c, dates));
        break;
      }
      case 'payback': {
        const c = toNums(parseCSV(args.cashflows));
        print(F.paybackPeriod(c));
        break;
      }
      case 'pi': {
        const rate = Number(args.rate);
        const c = toNums(parseCSV(args.cashflows));
        print(F.profitabilityIndex(rate, c));
        break;
      }
      case 'annuity-pv': {
        const r = Number(args.rate), n = Number(args.n), pmt = Number(args.pmt);
        print(F.annuityPV(r, n, pmt));
        break;
      }
      case 'annuity-fv': {
        const r = Number(args.rate), n = Number(args.n), pmt = Number(args.pmt);
        print(F.annuityFV(r, n, pmt));
        break;
      }
      case 'bond-price': {
        const face = Number(args.face), coupon = Number(args.coupon), y = Number(args.yield);
        const n = Number(args.n), freq = Number(args.freq || 1);
        print(F.bondPrice(face, coupon, y, n, freq));
        break;
      }
      case 'bond-yield': {
        const face = Number(args.face), coupon = Number(args.coupon), price = Number(args.price);
        const n = Number(args.n), freq = Number(args.freq || 1);
        print(F.bondYield(face, coupon, price, n, freq));
        break;
      }
      case 'duration': {
        const face = Number(args.face), coupon = Number(args.coupon), y = Number(args.yield);
        const n = Number(args.n), freq = Number(args.freq || 1);
        print(F.macaulayDuration(face, coupon, y, n, freq));
        break;
      }
      case 'convexity': {
        const face = Number(args.face), coupon = Number(args.coupon), y = Number(args.yield);
        const n = Number(args.n), freq = Number(args.freq || 1);
        print(F.convexity(face, coupon, y, n, freq));
        break;
      }
      case 'wacc': {
        const we = Number(args.we), wd = Number(args.wd), re = Number(args.re), rd = Number(args.rd), tax = Number(args.tax);
        print(F.wacc({ we, wd, re, rd, tax }));
        break;
      }
      case 'ddm-gordon': {
        const d1 = Number(args.d1), g = Number(args.g), r = Number(args.r);
        print(F.ddmGordon(d1, g, r));
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
