// Routed through the Vite dev-server proxy (vite.config.ts) to avoid the
// browser CORS block on query1.finance.yahoo.com. That proxy only exists in
// `npm run dev` — a production deployment needs its own backend/serverless
// proxy in front of this same endpoint.
const CHART_BASE = "/yahoo-api/v8/finance/chart";

export interface YahooBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooChartMeta {
  regularMarketPrice: number;
  previousClose?: number;
  chartPreviousClose?: number;
  longName?: string;
  shortName?: string;
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: YahooChartMeta;
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

export async function fetchYahooChart(
  symbol: string,
  interval: string,
  range: string
): Promise<{ meta: YahooChartMeta; bars: YahooBar[] }> {
  const res = await fetch(`${CHART_BASE}/${symbol}?interval=${interval}&range=${range}`);
  if (!res.ok) {
    throw new Error(`Yahoo Finance request failed for ${symbol}: HTTP ${res.status}`);
  }

  const body: YahooChartResponse = await res.json();
  const result = body.chart.result?.[0];
  if (!result) {
    throw new Error(body.chart.error?.description ?? `No chart data returned for ${symbol}`);
  }

  const { meta, timestamp, indicators } = result;
  const q = indicators.quote[0];

  const bars: YahooBar[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const open = q.open[i];
    const high = q.high[i];
    const low = q.low[i];
    const close = q.close[i];
    if (open == null || high == null || low == null || close == null) continue;
    bars.push({ time: timestamp[i], open, high, low, close, volume: q.volume[i] ?? 0 });
  }

  return { meta, bars };
}
