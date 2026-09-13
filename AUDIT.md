# Quantitative and interface audit — 2026-09-13

## Scope

Reviewed the complete `index.html`, README, external data URLs, and the companion repository's daily/intraday generation scripts. The app repository itself contained only `index.html` and README; the price-generation workflows belong to the companion repository and were not modified.

Baseline: `a3e7bbfa7bfef226a5ba91438cbb09c29247c129`.

This is an engineering/research audit, not a certification of profitability or exchange execution accuracy.

## Verified fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | Intraday regime filters could access the same calendar day's final daily close before it was available. | Daily features use the last bucket whose end is at or before the entry mark. |
| Critical | An unfinished 4H bucket could supply a close for an entry within that bucket. | Completed-bar lookup and exact mark alignment; invalid sessions are excluded. |
| High | A path with missing buckets could be scored as complete. | Require every expected bucket from entry to expiry, for both intraday and multi-day tests. |
| High | Current unfinished daily/intraday buckets could enter historical samples. | Filter buckets by availability time at load; expiry must also be no later than now. |
| High | Multi-day trade timestamps named the day bucket rather than the actual daily-close availability. | Actual entry/expiry timestamps use bucket end. The selected weekday still refers to the labeled daily close (Friday close becomes Saturday 00:00 UTC). |
| High | Live anchor fallback returned the first historical value even when entry preceded all history, or silently substituted current spot. | Return unavailable for missing/stale entry references; upcoming sessions retain clearly labeled previews. |
| High | Delayed entry-price requests could overwrite a newer session's reference. | Validate requested session/mode before accepting results, including the returned 1-minute bucket timestamp. |
| High | Expired model Greeks reused the full original tenor. | Expired horizon is zero; undefined Greeks display unavailable. |
| High | Quote return selection optimized only the training mean. | Separate training, validation and final chronological holdout; positive training/validation means and an explicit tail-loss constraint are required. No candidate is selected when all fail. |
| High | Quote returns did not expose BTC backing contribution. | Show option, BTC backing and combined returns separately. |
| High | CSP quote policies could differ only by irrelevant call targets or contain conflicting put quotes. | Group by put target in CSP mode and reject inconsistent same-session put quotes. |
| Medium | Full-sample automatically fitted ranges looked like forward-looking evidence. | Label as descriptive/full-sample; preserve the separately evaluated Explorer. |
| Medium | Some legacy holdout training windows included unexpired overlapping trades. | Purge them at the holdout boundary. Quote training and validation are each purged at their next boundary. |
| Medium | Minimum-width range fallback could miss the requested count with one-sided samples. | Search intervals expanded to include zero and retain the requested empirical observation count. |
| Medium | RV and moving-average labels could span gaps while claiming fixed-day windows. | Require consecutive daily intervals for RV, MA200 and 30-day momentum. |
| Medium | Invalid prices and conflicting duplicate timestamps were silently accepted. | Remove invalid/conflicting rows and report diagnostics. |
| Medium | The straddle desk displayed breakeven boundaries as strikes. | Display ATM strikes and label the separate breakeven band. |
| Medium | CSP live monitoring could flag an untraded call-side breach. | Put-only range status and no written-call display. General two-sided price-range diagnostics remain explicitly reference-band studies. |
| Medium | Zero-strike protective put generated NaN Greeks; singleton/constant chart ranges could divide by zero. | Zero Greeks for identically worthless put and guarded chart scales. |
| Medium | Applying precise delta-derived strikes conflicts with HTML's 0.5% input step. | Percentage-distance inputs allow arbitrary precision and validate positive strikes. |
| UX | Dense session statistics and comparison explanations dominated the entry desk. | Expandable secondary details; larger entry values; navigation shortcuts and current/applied-range status. |
| UX | Delta magnitude duplicated the same number and the seller sign was secondary. | Short-position / long-option order and explanatory labels. |
| UX | Small controls, unlabeled fields and wide tables hurt touch/keyboard use. | Associated labels, visible focus, 44px mobile controls, horizontal scroll hints, constrained grid widths and reduced-motion support. |
| Reliability | Changing settings waited for live network requests; failed data downloads had no timeout. | Research runs independently of entry fetch, source timeouts, and explicit failure status. |

## Validation

- `node tests/audit.test.cjs`: 18 regression groups, covering timestamp cutoffs, partial/gapped paths, multi-day tenor, RV causality, minimum-width coverage, delta inversion/parity, independent payoff accounting, expired tenor, quote units/costs, validation and final-holdout separation, candidate rejection, and rendering all four research modes plus an empty sample.
- Real companion daily/4H JSON snapshot: 5,369 completed daily bars and 32,209 completed 4H bars; default Friday study produced 767 complete sessions, with 536 training and 231 holdout observations. Node test-double calculation/render took approximately 1.95 seconds in this environment. This is not a browser/mobile performance benchmark.
- Baseline published interface inspected in Chrome. Localhost preview is blocked by the managed browser, so post-publish browser checks use the published app and responsive iframe harness. See final delivery for the checks actually completed.
- Actual historical option quotes were not supplied; quote tests use explicitly synthetic fixtures. No synthetic quotes enter the application defaults.

## Remaining limits

1. Price files contain bucket closes, not a complete minute path. Their upstream generator permits partially populated buckets. Excluding missing buckets does not certify completeness of every minute within each bucket.
2. Deribit delivery TWAP, inverse-contract conventions, historical exchange strikes, fills and IV are not reconstructed from BTC closes. Quote import requires an explicitly normalized USD-linear per-BTC dataset, supplied and verified by the operator.
3. No-touch is a measured-close/path proxy. Hourly/4-hour observation cannot establish the absence of an intrabar touch.
4. RV is a substitute for IV, not recovered historical option volatility. Equal inputs, rounded tails and near-ATM options can still produce repetitive delta values.
5. Quote metrics are per-trade returns on the declared backed capital. They do not model an account equity path, overlapping position allocations, mark-to-market drawdown, execution liquidity or exchange margin. No APR or Calmar is claimed.
6. Repeated manual inspection/tuning can contaminate the final holdout. The app does not enforce a permanently locked research protocol. Minimum sample counts are operational gates, not statistical sufficiency guarantees.
7. The data-selected desk is a candidate preview. Applying it transfers distances to a retrospective fixed-range study, not a historical constant-delta contract backtest.
8. The app remains a large single-file implementation. The added regression gate reduces risk; a future module extraction should preserve these tests rather than rewrite the whole app without parity checks.

## Sources inspected

- [Daily source generator](https://github.com/0xtrvkc/dynamic-btc-analytics-dashboard/blob/main/generate_price_json.py)
- [Intraday source generator](https://github.com/0xtrvkc/dynamic-btc-analytics-dashboard/blob/main/generate_intraday_price_json.py)
- [Original weekend options study](https://insights.deribit.com/education/option-backtest-selling-weekend-vol/)
