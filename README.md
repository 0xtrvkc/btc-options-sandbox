# BTC Options Sandbox

A browser-based BTC range-risk research terminal for studying short strangle and short straddle setups using historical BTC price behavior.

The default workflow is built around a **Friday 0DTE short-premium session**:

- Entry reference: **Friday 00:00 UTC / 07:00 Bangkok**
- Expiry reference: **Friday 08:00 UTC / 15:00 Bangkok**
- Historical engine: BTC price only
- Live layer: current BTC reference for session monitoring and theoretical model diagnostics

The project is intentionally designed to answer a narrower and more defensible question than a full historical options backtest:

> Given a BTC entry price and a selected put/call range, how often did BTC finish inside that range at expiry, how often did price leave the range before expiry, and how stable was that behavior through history?

It does **not** reconstruct historical option premiums, historical IV, or historical option P&L.

## Why this exists

Short-premium strategies can show attractive win rates while hiding unstable regimes and severe tail events. This sandbox focuses on the underlying BTC price process first:

- expiry containment
- path/touch behavior
- tail breaches
- calibration
- walk-forward stability
- regime dependence
- parameter robustness

The goal is not to prove that selling options is profitable. The goal is to understand how reliably a chosen BTC range has historically contained price over the selected session.

## Main features

### Friday 0DTE default

The default preset studies a Friday session from **00:00 UTC to 08:00 UTC**.

For a short strangle, a historical observation is classified as contained when BTC expires between the selected lower and upper boundaries.

For a short straddle, the app uses a user-defined hypothetical total credit as a breakeven-width proxy. This is a model assumption, not reconstructed historical premium.

### Research presets

- **Friday 0DTE** — default
- **Weekend benchmark** — Friday 16:00 UTC to Sunday 08:00 UTC
- **Custom same-day intraday**
- **Multi-day legacy research**

The weekend benchmark is included as a price-behavior control inspired by Deribit research on selling weekend volatility. It does not reproduce the original option P&L backtest because this app does not use historical option-chain data.

## Historical range analytics

The terminal includes:

- expiry containment rate
- lower-side breach rate
- upper-side breach rate
- no-touch proxy
- touched-and-recovered rate
- horizon return standard deviation
- mean and median return
- empirical quantiles
- skewness
- excess kurtosis
- Jarque-Bera normality diagnostic
- return autocorrelation
- absolute-return autocorrelation
- squared-return autocorrelation
- empirical vs Normal containment
- tail-frequency diagnostics

### Distribution views

- Histogram with Normal overlay
- Empirical CDF
- Normal Q-Q plot

The Normal model is treated as a comparison model, not an assumption that BTC returns are actually Gaussian.

## Automatic range construction

The app supports multiple ways to define the put/call range:

- Manual percentage boundaries
- Empirical equal-tail interval
- Empirical minimum-width interval
- Short-straddle breakeven-width proxy

A required-range ladder shows the historical range needed to contain selected percentages of observations, including 50%, 70%, 80%, 90%, and 95% targets.

## Walk-forward testing

The walk-forward engine estimates each historical range using only observations that were available before that trade.

Available controls include:

- training window length
- equal-tail vs minimum-width model
- target containment level

This is designed to reduce look-ahead bias and make the result closer to an actual historical decision process.

## Calibration

The calibration panel compares:

- target containment
- observed out-of-sample containment
- calibration error

For example, an estimated 80% historical range should contain close to 80% of future observations if the model is well calibrated.

## Chronological holdout

A later portion of the sample can be held out from model construction.

The earlier sample determines the range, and the later sample tests whether that range continued to behave as expected.

This is useful for detecting a strategy or range rule that only looks good because it was fitted to the same history being evaluated.

## Robustness and fragility

The parameter-robustness tools test nearby configurations rather than relying on one exact setting.

Examples include:

- nearby Friday entry times
- slightly narrower ranges
- current range
- slightly wider ranges

A result that changes dramatically after a tiny parameter adjustment should be treated as fragile.

## Tail-risk diagnostics

Because short-volatility strategies can be negatively skewed, the app does not stop at containment rate.

It also studies:

- mean breach severity
- worst lower breach
- worst upper breach
- tail expected shortfall proxies
- largest historical moves
- concentration of total boundary exceedance in the worst 1, 3, and 5 events

This helps distinguish "many small contained sessions" from the size of the sessions that escape the range.

## Path-risk analytics

When intraday data is available, the app estimates:

- path minimum and maximum
- first boundary touched
- time to first touch
- no-touch rate
- touched then recovered
- maximum adverse excursion proxies

The source data contains intraday closes rather than complete exchange-level tick paths, so touch statistics are explicitly labeled as proxies.

## Regime analysis

Historical observations can be filtered by market state, including:

- realized-volatility regime
- above/below 200-day moving average
- 30-day momentum
- drawdown regime

The app also shows realized-volatility term structure and volatility-of-volatility diagnostics.

## Entry-time and day-of-week studies

The terminal includes:

- Friday entry-time sensitivity
- day-of-week comparison
- horizon x range surfaces
- Friday-vs-other-days comparisons

These help test whether an apparent edge is specific to the intended Friday session or simply a general property of BTC volatility.

## Deribit-style weekend benchmark

A separate benchmark compares the default Friday 0DTE session with a longer weekend window:

- Friday 16:00 UTC entry
- Sunday 08:00 UTC expiry

The comparison focuses on price behavior such as:

- median absolute move
- return standard deviation
- containment
- no-touch proxy
- required range
- realized-volatility differences

Reference research:

- [Option Backtest: Selling Weekend Vol](https://insights.deribit.com/education/option-backtest-selling-weekend-vol/)
- [Option Backtest: Selling Weekend Vol Revisited](https://insights.deribit.com/education/option-backtest-selling-weekend-vol-revisited/)

## Live BTC layer

The app can pull a live **BTCUSDT market reference** and use it for the current-session layer.

Live price is used for:

- current BTC display
- current distance to put/call strikes
- live inside/below-put/above-call status
- current-session move
- remaining time to expiry
- remaining-IV expected move
- payoff marker
- theoretical Greeks

During an active Friday session, strike prices remain anchored to the session entry reference. They do not continuously move with BTC.

The live market reference is **not** treated as historical research data and does not modify historical backtest observations.

It is also not the Deribit settlement index or the exact Deribit settlement TWAP.

## Theoretical payoff and Greeks

The sandbox includes a model layer for:

- payoff diagram
- net Delta
- net Gamma
- net Theta/day
- net Vega
- model put/call strikes
- hypothetical breakevens

These calculations use user-provided/model inputs such as IV, rate, assumed credit, live BTC when available, and remaining time to expiry.

They are theoretical diagnostics only.

## Data architecture

Historical data is loaded dynamically from the companion repository:

[`0xtrvkc/dynamic-btc-analytics-dashboard`](https://github.com/0xtrvkc/dynamic-btc-analytics-dashboard)

The app looks for:

- `btc_daily_price.json`
- `btc_1h_price.json`
- `btc_4h_price.json`

It first supports local copies and then falls back to remote GitHub/jsDelivr sources.

Because dates and sample sizes are discovered dynamically, future BTC observations can be added without changing the HTML itself. New completed sessions automatically become part of the statistical sample when the underlying JSON data updates.

## Bangkok schedule

The default Friday workflow translates to Bangkok time as:

```text
06:37 BKK  historical intraday data refresh
07:00 BKK  Friday 0DTE entry reference
07:17 BKK  daily data refresh
15:00 BKK  08:00 UTC expiry reference
15:37 BKK  post-expiry intraday refresh
```

The data-generation workflows live in the companion BTC analytics repository.

## Running locally

The project is intentionally a single-file browser app.

Clone the repository:

```bash
git clone https://github.com/0xtrvkc/btc-options-sandbox.git
cd btc-options-sandbox
```

Serve it with any simple static server, for example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Using a local web server is recommended instead of opening `index.html` directly because browsers may restrict network requests from `file://` pages.

## GitHub Pages

The app requires no backend and is suitable for GitHub Pages.

In the repository:

1. Open **Settings -> Pages**.
2. Select **Deploy from a branch**.
3. Choose `main` and `/ (root)`.
4. Save.

## Project structure

```text
btc-options-sandbox/
├── index.html
└── README.md
```

Historical JSON is intentionally kept in the companion data repository instead of being duplicated here.

## Important limitations

This project is a research sandbox, not an execution engine and not a historical options-chain backtester.

It does not know the historical:

- option bid/ask
- option premium
- implied volatility surface
- option delta used by the exchange
- slippage
- fees
- margin impact
- liquidation path

Therefore metrics such as historical option P&L, CAGR, Sharpe, Calmar, profit factor, or historical strategy APR are intentionally not presented as real results.

`Expiry containment` means BTC finished inside a selected price range. It does **not** automatically mean the corresponding short option position was profitable.

## Disclaimer

For research and educational use only. Nothing in this repository is financial advice or a recommendation to trade BTC or options. Short options can have substantial or theoretically unlimited loss exposure depending on the position structure.

## License

No license has been added yet. If you want others to reuse or modify the project, add an explicit open-source license such as MIT.
