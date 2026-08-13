import { useEffect, useMemo, useState } from "react";
import Watchlist from "../components/Watchlist";
import PriceChart from "../components/PriceChart";
import OrderBook from "../components/OrderBook";
import { SYMBOLS, fetchSymbolSnapshot, type Symbol, type SymbolSnapshot } from "../data/yahooFeed";
import { generateOrderBook } from "../data/orderBookSim";

const POLL_MS = 30_000;

export default function Dashboard() {
  const [snapshots, setSnapshots] = useState<Partial<Record<Symbol, SymbolSnapshot>>>({});
  const [errors, setErrors] = useState<Partial<Record<Symbol, string>>>({});
  const [selected, setSelected] = useState<Symbol>(SYMBOLS[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const results = await Promise.allSettled(SYMBOLS.map((s) => fetchSymbolSnapshot(s)));
      if (cancelled) return;

      setSnapshots((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r.status === "fulfilled") next[SYMBOLS[i]] = r.value;
        });
        return next;
      });
      setErrors(() => {
        const next: Partial<Record<Symbol, string>> = {};
        results.forEach((r, i) => {
          if (r.status === "rejected") next[SYMBOLS[i]] = r.reason?.message ?? "Failed to load";
        });
        return next;
      });
      setLoading(false);
    }

    loadAll();
    const id = setInterval(loadAll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const quotes = useMemo(
    () =>
      SYMBOLS.filter((s) => snapshots[s]).map((s) => snapshots[s]!.quote),
    [snapshots]
  );

  const selectedSnapshot = snapshots[selected];
  const orderBook = useMemo(
    () => (selectedSnapshot ? generateOrderBook(selectedSnapshot.quote.price) : null),
    [selectedSnapshot]
  );

  if (loading) {
    return (
      <main className="dashboard-status">
        <p>Loading live NSE data…</p>
      </main>
    );
  }

  if (quotes.length === 0) {
    return (
      <main className="dashboard-status">
        <p>Couldn't load live data for any symbol.</p>
        <ul className="error-list">
          {Object.entries(errors).map(([sym, msg]) => (
            <li key={sym}>
              {sym}: {msg}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="dashboard-grid">
      <Watchlist quotes={quotes} selected={selected} onSelect={setSelected} />
      {selectedSnapshot ? (
        <PriceChart symbol={selected} candles={selectedSnapshot.candles} />
      ) : (
        <div className="panel price-chart">
          <p>No chart data for this symbol yet.</p>
        </div>
      )}
      {orderBook ? (
        <OrderBook book={orderBook} />
      ) : (
        <div className="panel order-book">
          <p>Order book unavailable.</p>
        </div>
      )}
    </main>
  );
}
