import { fetchYahooChart } from "./yahooChart";
import { computeRSISeries, lastDefined, sma } from "./taMath";

export interface StockRef {
  symbol: string; // NSE ticker incl. .NS
  name: string;
}

export interface Criterion {
  key: string;
  label: string;
  pass: boolean | null; // null = not enough history to evaluate
  detail: string;
}

export interface ScreenerSnapshot {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  criteria: Criterion[];
  score: number; // criteria passed
  evaluable: number; // criteria with a non-null verdict
  verdict: "green" | "yellow" | "red";
}

export async function fetchScreenerSnapshot(stock: StockRef): Promise<ScreenerSnapshot> {
  const { meta, bars } = await fetchYahooChart(stock.symbol, "1d", "1y");

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const rsiSeries = computeRSISeries(closes, 14);
  const latestRsi = lastDefined(rsiSeries);
  const rsiSma22 = sma(rsiSeries, 22);
  const rsiSma44 = sma(rsiSeries, 44);
  const rsiSma66 = sma(rsiSeries, 66);

  const longTermSupport = sma(closes, 200);
  const avgVolume2Mo = sma(volumes, 44); // ~2 trading months
  const latestVolume = volumes[volumes.length - 1] ?? 0;

  const price = meta.regularMarketPrice;
  // meta.previousClose is only populated for short ranges; for a 1y request
  // it's undefined and chartPreviousClose is ~a year old, not yesterday's
  // close. Use the actual last two daily bars instead.
  const previousClose = closes.length >= 2 ? closes[closes.length - 2] : price;
  const changePct = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;

  const rsiPass =
    latestRsi !== null && rsiSma22 !== null && rsiSma44 !== null && rsiSma66 !== null
      ? latestRsi > rsiSma22 && latestRsi > rsiSma44 && latestRsi > rsiSma66
      : null;

  const criteria: Criterion[] = [
    {
      key: "volume",
      label: "Volume above 2-month avg",
      pass: avgVolume2Mo !== null ? latestVolume > avgVolume2Mo : null,
      detail:
        avgVolume2Mo !== null
          ? `${(latestVolume / avgVolume2Mo).toFixed(2)}x the 44-day average`
          : "Not enough history",
    },
    {
      key: "support",
      label: "Above long-term support (200D)",
      pass: longTermSupport !== null ? price > longTermSupport : null,
      detail:
        longTermSupport !== null
          ? `Price ${price.toFixed(0)} vs 200D avg ${longTermSupport.toFixed(0)}`
          : "Not enough history",
    },
    {
      key: "rsi",
      label: "RSI above 22/44/66-day averages",
      pass: rsiPass,
      detail:
        rsiPass !== null
          ? `RSI ${latestRsi!.toFixed(0)} vs ${rsiSma22!.toFixed(0)}/${rsiSma44!.toFixed(0)}/${rsiSma66!.toFixed(0)}`
          : "Not enough history",
    },
    {
      key: "marketCap",
      label: "Market cap above ₹1,000 Cr",
      // Not evaluable: the free Yahoo chart endpoint has no market-cap
      // field, and the endpoint that does (quoteSummary) requires an
      // authenticated crumb/session this app doesn't have. Excluded from
      // scoring rather than guessed.
      pass: null,
      detail: "Not available (needs a paid/authenticated data source)",
    },
    {
      key: "liquidity",
      label: "Trading volume above 1,000",
      pass: latestVolume > 1000,
      detail: `${latestVolume.toLocaleString("en-IN")} shares today`,
    },
  ];

  const evaluableCriteria = criteria.filter((c) => c.pass !== null);
  const score = evaluableCriteria.filter((c) => c.pass).length;
  const evaluable = evaluableCriteria.length;

  let verdict: ScreenerSnapshot["verdict"] = "red";
  if (evaluable > 0 && score === evaluable) verdict = "green";
  else if (evaluable > 0 && score / evaluable >= 0.5) verdict = "yellow";

  return {
    symbol: stock.symbol,
    name: stock.name,
    price,
    changePct,
    criteria,
    score,
    evaluable,
    verdict,
  };
}
