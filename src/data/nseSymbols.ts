// Same CORS situation as yahooChart.ts: archives.nseindia.com sends no
// Access-Control-Allow-Origin header. Vite's dev proxy handles this path in
// `npm run dev`; the Vercel function at api/nse/[...path].ts handles it in
// production.
const NSE_EQUITY_LIST_URL = "/api/nse/content/equities/EQUITY_L.csv";

export interface NseEquity {
  symbol: string; // bare NSE ticker, no .NS suffix
  name: string;
}

let cached: NseEquity[] | null = null;

// NSE's list also includes "BE"/"BZ" trade-to-trade series (surveillance
// restrictions, different settlement) — keep only the normal "EQ" series,
// which is what every other price/volume/RSI figure on this page assumes.
export async function fetchNseEquityList(): Promise<NseEquity[]> {
  if (cached) return cached;

  const res = await fetch(NSE_EQUITY_LIST_URL);
  if (!res.ok) {
    throw new Error(`Failed to load NSE equity list: HTTP ${res.status}`);
  }
  const text = await res.text();

  const list: NseEquity[] = [];
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 3) continue;
    const symbol = cols[0]?.trim();
    const name = cols[1]?.trim();
    const series = cols[2]?.trim();
    if (!symbol || series !== "EQ") continue;
    list.push({ symbol, name });
  }
  list.sort((a, b) => a.symbol.localeCompare(b.symbol));

  cached = list;
  return list;
}
