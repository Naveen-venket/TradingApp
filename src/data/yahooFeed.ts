import type { Candle, Quote } from "../types";
import { fetchYahooChart } from "./yahooChart";

export const SYMBOLS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "TMPV.NS"] as const;
export type Symbol = (typeof SYMBOLS)[number];

export function displaySymbol(symbol: Symbol): string {
  return symbol.replace(".NS", "");
}

export interface SymbolSnapshot {
  quote: Quote;
  candles: Candle[];
}

export async function fetchSymbolSnapshot(
  symbol: Symbol,
  range = "1d",
  interval = "5m"
): Promise<SymbolSnapshot> {
  const { meta, bars } = await fetchYahooChart(symbol, interval, range);

  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
  const price = meta.regularMarketPrice;
  const changePct = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;

  return {
    quote: { symbol, price, changePct },
    candles: bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
  };
}
