import { fetchYahooChart } from "./yahooChart";
import { computeRSISeries, lastDefined, sma } from "./taMath";

export interface StockRef {
  symbol: string; // bare NSE ticker, no .NS suffix
  name: string;
}

// Stand-in for Step 1 ("Mcap > ₹1,000 Cr"): there's no free/live market-cap
// source (Yahoo's free endpoint doesn't have it, and NSE's own site blocks
// unauthenticated requests at the edge — see nseSymbols.ts / earlier
// testing). This is a hand-picked Nifty 50 + Nifty Next 50-ish set of
// large/upper-mid caps that are comfortably above that bar as a practical
// substitute for a live check. Index membership drifts over time and a few
// tickers can be stale (renamed/demerged) — those just fail to fetch and
// get excluded rather than crash anything.
export const CURATED_UNIVERSE: StockRef[] = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel" },
  { symbol: "ITC", name: "ITC" },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "LT", name: "Larsen & Toubro" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" },
  { symbol: "AXISBANK", name: "Axis Bank" },
  { symbol: "MARUTI", name: "Maruti Suzuki" },
  { symbol: "SUNPHARMA", name: "Sun Pharma" },
  { symbol: "TITAN", name: "Titan Company" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement" },
  { symbol: "NTPC", name: "NTPC" },
  { symbol: "WIPRO", name: "Wipro" },
  { symbol: "ADANIENT", name: "Adani Enterprises" },
  { symbol: "ADANIPORTS", name: "Adani Ports" },
  { symbol: "ASIANPAINT", name: "Asian Paints" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto" },
  { symbol: "BEL", name: "Bharat Electronics" },
  { symbol: "CIPLA", name: "Cipla" },
  { symbol: "COALINDIA", name: "Coal India" },
  { symbol: "DRREDDY", name: "Dr Reddy's Labs" },
  { symbol: "EICHERMOT", name: "Eicher Motors" },
  { symbol: "GRASIM", name: "Grasim Industries" },
  { symbol: "HCLTECH", name: "HCL Technologies" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp" },
  { symbol: "HINDALCO", name: "Hindalco Industries" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank" },
  { symbol: "JSWSTEEL", name: "JSW Steel" },
  { symbol: "M&M", name: "Mahindra & Mahindra" },
  { symbol: "NESTLEIND", name: "Nestle India" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp" },
  { symbol: "POWERGRID", name: "Power Grid Corp" },
  { symbol: "SBILIFE", name: "SBI Life Insurance" },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products" },
  { symbol: "TMPV", name: "Tata Motors Passenger Vehicles" },
  { symbol: "TATASTEEL", name: "Tata Steel" },
  { symbol: "TECHM", name: "Tech Mahindra" },
  { symbol: "TRENT", name: "Trent" },
  { symbol: "UPL", name: "UPL" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals" },
  { symbol: "BPCL", name: "Bharat Petroleum" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories" },
  { symbol: "GAIL", name: "GAIL India" },
  { symbol: "IOC", name: "Indian Oil Corp" },
  { symbol: "PIDILITIND", name: "Pidilite Industries" },
  { symbol: "DABUR", name: "Dabur India" },
  { symbol: "GODREJCP", name: "Godrej Consumer Products" },
  { symbol: "MARICO", name: "Marico" },
  { symbol: "COLPAL", name: "Colgate-Palmolive India" },
  { symbol: "HAVELLS", name: "Havells India" },
  { symbol: "SIEMENS", name: "Siemens" },
  { symbol: "ABB", name: "ABB India" },
  { symbol: "DLF", name: "DLF" },
  { symbol: "LUPIN", name: "Lupin" },
  { symbol: "AUROPHARMA", name: "Aurobindo Pharma" },
  { symbol: "BIOCON", name: "Biocon" },
  { symbol: "MOTHERSON", name: "Samvardhana Motherson" },
  { symbol: "BOSCHLTD", name: "Bosch" },
  { symbol: "MRF", name: "MRF" },
  { symbol: "PAGEIND", name: "Page Industries" },
  { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals" },
  { symbol: "ZYDUSLIFE", name: "Zydus Lifesciences" },
  { symbol: "ICICIPRULI", name: "ICICI Prudential Life" },
  { symbol: "ICICIGI", name: "ICICI Lombard General Insurance" },
  { symbol: "SBICARD", name: "SBI Cards" },
  { symbol: "BANKBARODA", name: "Bank of Baroda" },
  { symbol: "PNB", name: "Punjab National Bank" },
  { symbol: "CANBK", name: "Canara Bank" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank" },
  { symbol: "FEDERALBNK", name: "Federal Bank" },
  { symbol: "AUBANK", name: "AU Small Finance Bank" },
  { symbol: "INDIGO", name: "InterGlobe Aviation" },
  { symbol: "IRCTC", name: "IRCTC" },
  { symbol: "NAUKRI", name: "Info Edge" },
  { symbol: "ADANIGREEN", name: "Adani Green Energy" },
  { symbol: "ADANIPOWER", name: "Adani Power" },
  { symbol: "TATAPOWER", name: "Tata Power" },
  { symbol: "TVSMOTOR", name: "TVS Motor" },
  { symbol: "BALKRISIND", name: "Balkrishna Industries" },
  { symbol: "ASHOKLEY", name: "Ashok Leyland" },
  { symbol: "CUMMINSIND", name: "Cummins India" },
  { symbol: "ABBOTINDIA", name: "Abbott India" },
  { symbol: "ALKEM", name: "Alkem Laboratories" },
  { symbol: "VOLTAS", name: "Voltas" },
  { symbol: "CROMPTON", name: "Crompton Greaves Consumer" },
  { symbol: "JUBLFOOD", name: "Jubilant FoodWorks" },
  { symbol: "VBL", name: "Varun Beverages" },
  { symbol: "UBL", name: "United Breweries" },
  { symbol: "GODREJPROP", name: "Godrej Properties" },
  { symbol: "OBEROIRLTY", name: "Oberoi Realty" },
  { symbol: "VEDL", name: "Vedanta" },
  { symbol: "JINDALSTEL", name: "Jindal Steel & Power" },
  { symbol: "SAIL", name: "Steel Authority of India" },
  { symbol: "SHREECEM", name: "Shree Cement" },
  { symbol: "AMBUJACEM", name: "Ambuja Cements" },
  { symbol: "BRITANNIA", name: "Britannia Industries" },
  { symbol: "PFC", name: "Power Finance Corp" },
  { symbol: "RECLTD", name: "REC Limited" },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance" },
  { symbol: "CHOLAFIN", name: "Cholamandalam Investment" },
  { symbol: "PERSISTENT", name: "Persistent Systems" },
  { symbol: "COFORGE", name: "Coforge" },
  { symbol: "MPHASIS", name: "Mphasis" },
];

export interface MomentumSnapshot {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  avgVolume20Value: number | null; // null = not enough history
  latestVolume: number;
  volumePass: boolean; // Step 2 filter
  rsi22: number | null;
  rsi44: number | null;
  rsi66: number | null;
  avgRsi: number | null; // Step 3
  signal: number | null; // A = %(RSI>60) - %(RSI<40), in percentage points
  tag: "entry" | "exit" | "neutral";
}

function computeSignal(rsiValues: number[]): number {
  if (rsiValues.length === 0) return 0;
  const above60 = rsiValues.filter((v) => v > 60).length;
  const below40 = rsiValues.filter((v) => v < 40).length;
  return ((above60 - below40) / rsiValues.length) * 100;
}

export async function fetchMomentumSnapshot(stock: StockRef): Promise<MomentumSnapshot> {
  const { meta, bars } = await fetchYahooChart(`${stock.symbol}.NS`, "1d", "1y");

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const avgVolume20Value = sma(volumes, 20);
  const latestVolume = volumes[volumes.length - 1] ?? 0;
  const volumePass = avgVolume20Value !== null && avgVolume20Value > 50000;

  const rsi22 = lastDefined(computeRSISeries(closes, 22));
  const rsi44 = lastDefined(computeRSISeries(closes, 44));
  const rsi66 = lastDefined(computeRSISeries(closes, 66));

  const rsiValues = [rsi22, rsi44, rsi66].filter((v): v is number => v !== null);
  const avgRsi = rsiValues.length === 3 ? rsiValues.reduce((a, b) => a + b, 0) / 3 : null;
  const signal = rsiValues.length === 3 ? computeSignal(rsiValues) : null;

  const tag: MomentumSnapshot["tag"] = signal === null ? "neutral" : signal > 5 ? "entry" : signal < -5 ? "exit" : "neutral";

  const price = meta.regularMarketPrice;
  const previousClose = closes.length >= 2 ? closes[closes.length - 2] : price;
  const changePct = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;

  return {
    symbol: stock.symbol,
    name: stock.name,
    price,
    changePct,
    avgVolume20Value,
    latestVolume,
    volumePass,
    rsi22,
    rsi44,
    rsi66,
    avgRsi,
    signal,
    tag,
  };
}
