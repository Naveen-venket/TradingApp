import { useEffect, useMemo, useState } from "react";
import { fetchNseEquityList, type NseEquity } from "../data/nseSymbols";
import { fetchScreenerSnapshot, type ScreenerSnapshot } from "../data/screenerData";
import "./Screener.css";

type CriterionKey = "volume" | "support" | "rsi" | "marketCap" | "liquidity";
const CRITERION_KEYS: CriterionKey[] = ["volume", "support", "rsi", "marketCap", "liquidity"];
const CRITERION_SHORT_LABELS: Record<CriterionKey, string> = {
  volume: "Volume",
  support: "Support",
  rsi: "RSI",
  marketCap: "Mkt cap",
  liquidity: "Liquidity",
};

type VerdictFilter = "all" | "green" | "yellow" | "red";
const PAGE_SIZE = 20;

function VerdictPill({ verdict }: { verdict: ScreenerSnapshot["verdict"] }) {
  const label = verdict === "green" ? "Good buy" : verdict === "yellow" ? "Medium" : "Weak";
  return <span className={`verdict-pill verdict-${verdict}`}>{label}</span>;
}

function StockCard({ snapshot }: { snapshot: ScreenerSnapshot }) {
  return (
    <div className={`stock-card verdict-border-${snapshot.verdict}`}>
      <div className="stock-card-header">
        <div>
          <div className="stock-symbol">{snapshot.symbol.replace(".NS", "")}</div>
          <div className="stock-name">{snapshot.name}</div>
        </div>
        <VerdictPill verdict={snapshot.verdict} />
      </div>
      <div className="stock-price-row">
        <span className="stock-price">₹{snapshot.price.toFixed(2)}</span>
        <span className={snapshot.changePct >= 0 ? "positive" : "negative"}>
          {snapshot.changePct >= 0 ? "+" : ""}
          {snapshot.changePct.toFixed(2)}%
        </span>
        <span className="stock-score">
          {snapshot.score}/{snapshot.evaluable}
        </span>
      </div>
      <ul className="criteria-list">
        {snapshot.criteria.map((c) => (
          <li key={c.key} className={c.pass === null ? "crit-unknown" : c.pass ? "crit-pass" : "crit-fail"}>
            <span className="crit-mark">{c.pass === null ? "–" : c.pass ? "✓" : "✕"}</span>
            <span className="crit-label">{c.label}</span>
            <span className="crit-detail">{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Screener() {
  const [directory, setDirectory] = useState<NseEquity[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [reloadTick, setReloadTick] = useState(0);

  const [snapshots, setSnapshots] = useState<Record<string, ScreenerSnapshot>>({});
  const [pageLoading, setPageLoading] = useState(false);
  const [pageErrors, setPageErrors] = useState<{ symbol: string; message: string }[]>([]);

  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [criterionFilters, setCriterionFilters] = useState<Record<CriterionKey, boolean>>({
    volume: false,
    support: false,
    rsi: false,
    marketCap: false,
    liquidity: false,
  });

  useEffect(() => {
    fetchNseEquityList()
      .then(setDirectory)
      .catch((err) => setDirectoryError(err?.message ?? "Failed to load NSE symbol list"))
      .finally(() => setDirectoryLoading(false));
  }, []);

  const filteredDirectory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter((d) => d.symbol.toLowerCase().includes(q) || d.name.toLowerCase().includes(q));
  }, [directory, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDirectory.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const pageItems = useMemo(
    () => filteredDirectory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDirectory, page]
  );

  useEffect(() => {
    if (pageItems.length === 0) {
      setSnapshots({});
      setPageErrors([]);
      return;
    }
    let cancelled = false;
    setPageLoading(true);
    Promise.allSettled(
      pageItems.map((item) => fetchScreenerSnapshot({ symbol: `${item.symbol}.NS`, name: item.name }))
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, ScreenerSnapshot> = {};
      const errs: { symbol: string; message: string }[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") next[pageItems[i].symbol] = r.value;
        else errs.push({ symbol: pageItems[i].symbol, message: r.reason?.message ?? "Failed to load" });
      });
      setSnapshots(next);
      setPageErrors(errs);
      setPageLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pageItems, reloadTick]);

  const cards = useMemo(() => {
    const resolved = pageItems
      .map((item) => snapshots[item.symbol])
      .filter((s): s is ScreenerSnapshot => Boolean(s));
    resolved.sort((a, b) => b.score - a.score);

    const query = search.trim().toLowerCase();
    return resolved.filter((s) => {
      if (verdictFilter !== "all" && s.verdict !== verdictFilter) return false;
      for (const key of CRITERION_KEYS) {
        if (!criterionFilters[key]) continue;
        const crit = s.criteria.find((c) => c.key === key);
        if (!crit || crit.pass !== true) return false;
      }
      if (query && !s.symbol.toLowerCase().includes(query) && !s.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [pageItems, snapshots, verdictFilter, criterionFilters, search]);

  const toggleCriterion = (key: CriterionKey) =>
    setCriterionFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  const goToPage = (n: number) => setPage(Math.min(Math.max(1, n), totalPages));

  return (
    <main className="screener-page">
      <div className="panel screener-intro">
        <h2 className="panel-title">Stock screener</h2>
        <p className="checklist-note">
          Browsing the full NSE equity list ({directory.length || "…"} symbols), {PAGE_SIZE} at a
          time — live price/volume/RSI computed from a year of daily data. Market cap can't be
          evaluated here (no live source without a paid API) and is excluded from scoring. "Long-term
          support" is a 200-day-average proxy, not chart-pattern support. Search and filters apply to
          the page currently loaded, not the whole list — search first to jump straight to a stock.
        </p>
        <div className="screener-filters">
          <input
            className="screener-search"
            type="text"
            placeholder="Search symbol or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="verdict-filter-group">
            {(["all", "green", "yellow", "red"] as VerdictFilter[]).map((v) => (
              <button
                key={v}
                className={verdictFilter === v ? "active" : ""}
                onClick={() => setVerdictFilter(v)}
              >
                {v === "all" ? "All" : v === "green" ? "Good buy" : v === "yellow" ? "Medium" : "Weak"}
              </button>
            ))}
          </div>
          <div className="criterion-filter-group">
            {CRITERION_KEYS.map((key) => (
              <button
                key={key}
                className={criterionFilters[key] ? "active" : ""}
                onClick={() => toggleCriterion(key)}
              >
                {CRITERION_SHORT_LABELS[key]}
              </button>
            ))}
          </div>
          <button className="refresh-button" onClick={() => setReloadTick((t) => t + 1)} disabled={pageLoading}>
            {pageLoading ? "Loading…" : "Refresh page"}
          </button>
        </div>

        <div className="pagination">
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1 || pageLoading}>
            ← Prev
          </button>
          <span className="pagination-label">
            Page{" "}
            <input
              className="pagination-input"
              type="number"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => goToPage(Number(pageInput) || page)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToPage(Number(pageInput) || page);
              }}
            />{" "}
            of {totalPages} ({filteredDirectory.length} matching symbols)
          </span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages || pageLoading}>
            Next →
          </button>
        </div>

        {pageErrors.length > 0 && (
          <p className="screener-errors">
            Couldn't load: {pageErrors.map((e) => e.symbol).join(", ")}
          </p>
        )}
      </div>

      {directoryLoading ? (
        <p className="dashboard-status">Loading NSE symbol list…</p>
      ) : directoryError ? (
        <p className="dashboard-status">Couldn't load the NSE symbol list: {directoryError}</p>
      ) : pageLoading && cards.length === 0 ? (
        <p className="dashboard-status">Loading {pageItems.length} stocks…</p>
      ) : cards.length === 0 ? (
        <p className="dashboard-status">No stocks on this page match the current filters.</p>
      ) : (
        <div className="stock-card-grid">
          {cards.map((s) => (
            <StockCard key={s.symbol} snapshot={s} />
          ))}
        </div>
      )}
    </main>
  );
}
