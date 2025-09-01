# fincalc — finance formulas (CLI + library)

**fincalc** is a zero-dependency toolkit for common finance calculations. Use it from the **command line** or import it in code.

## ✨ Features
- NPV, IRR, XNPV, XIRR
- Payback period, Profitability Index
- Annuity PV/FV
- Bond price, Yield to Maturity, Macaulay Duration, Convexity
- WACC
- Gordon Growth (Dividend Discount Model)

## 🚀 CLI Usage
```bash
# NPV / IRR
fincalc npv --rate 0.1 --cashflows -100,50,60
fincalc irr --cashflows -100,40,40,40

# XIRR with ISO dates
fincalc xirr --cashflows -100,40,40,40 --dates 2025-01-01,2025-04-01,2025-07-01,2025-10-01

# Payback and PI
fincalc payback --cashflows -100,30,40,50
fincalc pi --rate 0.1 --cashflows -100,50,60

# Annuities
fincalc annuity-pv --rate 0.08 --n 5 --pmt 100
fincalc annuity-fv --rate 0.08 --n 5 --pmt 100

# Bonds (freq = coupons/year)
fincalc bond-price --face 1000 --coupon 0.05 --yield 0.06 --n 10 --freq 2
fincalc bond-yield --face 1000 --coupon 0.05 --price 950 --n 10 --freq 2
fincalc duration   --face 1000 --coupon 0.05 --yield 0.06 --n 10 --freq 2
fincalc convexity  --face 1000 --coupon 0.05 --yield 0.06 --n 10 --freq 2

# WACC
fincalc wacc --we 0.6 --wd 0.4 --re 0.12 --rd 0.07 --tax 0.21

# DDM (Gordon)
fincalc ddm-gordon --d1 2 --g 0.04 --r 0.09
