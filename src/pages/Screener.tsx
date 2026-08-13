import { useEffect, useMemo, useRef, useState } from "react";
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
const BATCH_SIZE = 25;

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

interface ScanState {
  active: boolean;
  done: boolean;
  checked: number;
  total: number;
}

const IDLE_SCAN: ScanState = { active: false, done: false, checked: 0, total: 0 };

export default function Screener() {
  const [directory, setDirectory] = useState<NseEquity[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  // Cache lives in refs (not state) so the batched scan loop always reads/
  // writes the latest data without stale closures; `version` is bumped to
  // force a re-render whenever the ref mutates.
  const cacheRef = useRef<Record<string, ScreenerSnapshot>>({});
  const errorRef = useRef<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  const [pageLoading, setPageLoading] = useState(false);
  const scanCancelRef = useRef(false);
  const [scanState, setScanState] = useState<ScanState>(IDLE_SCAN);

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
    // A running/finished scan was over the previous search scope — a new
    // search invalidates it.
    scanCancelRef.current = true;
    setScanState(IDLE_SCAN);
  }, [search]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const pageItems = useMemo(
    () => filteredDirectory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDirectory, page]
  );

  async function loadBatch(items: NseEquity[], force = false) {
    const targets = force
      ? items
      : items.filter((it) => !(it.symbol in cacheRef.current) && !(it.symbol in errorRef.current));
    if (targets.length === 0) return;
    const results = await Promise.allSettled(
      targets.map((it) => fetchScreenerSnapshot({ symbol: `${it.symbol}.NS`, name: it.name }))
    );
    results.forEach((r, i) => {
      const sym = targets[i].symbol;
      if (r.status === "fulfilled") {
        cacheRef.current[sym] = r.value;
        delete errorRef.current[sym];
      } else {
        errorRef.current[sym] = r.reason?.message ?? "Failed to load";
      }
    });
    setVersion((v) => v + 1);
  }

  // Paginated browse mode: fetch whatever the current page needs (skipping
  // anything already cached from a prior visit or scan).
  useEffect(() => {
    if (scanState.active || scanState.done) return;
    if (pageItems.length === 0) return;
    let cancelled = false;
    setPageLoading(true);
    loadBatch(pageItems).then(() => {
      if (!cancelled) setPageLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems, scanState.active, scanState.done]);

  const hasActiveFilter = verdictFilter !== "all" || CRITERION_KEYS.some((k) => criterionFilters[k]);

  async function runScan() {
    scanCancelRef.current = false;
    const items = filteredDirectory;
    setScanState({ active: true, done: false, checked: 0, total: items.length });
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      if (scanCancelRef.current) return;
      const batch = items.slice(i, i + BATCH_SIZE);
      await loadBatch(batch);
      if (scanCancelRef.current) return;
      setScanState((s) => ({ ...s, checked: Math.min(i + BATCH_SIZE, items.length) }));
    }
    setScanState((s) => ({ ...s, active: false, done: true }));
  }

  function cancelScan() {
    scanCancelRef.current = true;
    setScanState((s) => ({ ...s, active: false }));
  }

  function clearScan() {
    scanCancelRef.current = true;
    setScanState(IDLE_SCAN);
  }

  const scanMode = scanState.active || scanState.done;

  const displayedCards = useMemo(() => {
    const source = scanMode ? filteredDirectory : pageItems;
    const resolved = source
      .map((item) => cacheRef.current[item.symbol])
      .filter((s): s is ScreenerSnapshot => Boolean(s));
    resolved.sort((a, b) => b.score - a.score);
    return resolved.filter((s) => {
      if (verdictFilter !== "all" && s.verdict !== verdictFilter) return false;
      for (const key of CRITERION_KEYS) {
        if (!criterionFilters[key]) continue;
        const crit = s.criteria.find((c) => c.key === key);
        if (!crit || crit.pass !== true) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, filteredDirectory, pageItems, verdictFilter, criterionFilters, version]);

  const visibleErrors = useMemo(() => {
    const source = scanMode ? filteredDirectory : pageItems;
    return source.filter((it) => it.symbol in errorRef.current).map((it) => it.symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, filteredDirectory, pageItems, version]);

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
          support" is a 200-day-average proxy, not chart-pattern support. Turn on a filter below, then
          use "Scan all matches" to check every stock instead of just the current page.
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
          {!scanMode && (
            <button className="refresh-button" onClick={() => loadBatch(pageItems, true)} disabled={pageLoading}>
              {pageLoading ? "Loading…" : "Refresh page"}
            </button>
          )}
        </div>

        <div className="scan-controls">
          {!scanMode && (
            <>
              <button className="scan-button" onClick={runScan} disabled={!hasActiveFilter}>
                Scan all {filteredDirectory.length} stocks for matches
              </button>
              {!hasActiveFilter && (
                <span className="scan-hint">Turn on a verdict or criterion filter above first</span>
              )}
            </>
          )}
          {scanState.active && (
            <div className="scan-progress">
              <div className="scan-progress-bar">
                <div
                  className="scan-progress-fill"
                  style={{ width: `${(scanState.checked / Math.max(1, scanState.total)) * 100}%` }}
                />
              </div>
              <span className="scan-progress-label">
                Scanning… {scanState.checked} / {scanState.total} checked, {displayedCards.length} match
                {displayedCards.length === 1 ? "" : "es"} so far
              </span>
              <button className="scan-cancel" onClick={cancelScan}>
                Stop
              </button>
            </div>
          )}
          {scanState.done && (
            <div className="scan-progress">
              <span className="scan-progress-label">
                Scanned all {scanState.total} stocks — {displayedCards.length} match
                {displayedCards.length === 1 ? "" : "es"}
              </span>
              <button className="scan-cancel" onClick={runScan}>
                Rescan
              </button>
              <button className="scan-cancel" onClick={clearScan}>
                Back to browsing
              </button>
            </div>
          )}
        </div>

        {!scanMode && (
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
        )}

        {visibleErrors.length > 0 && (
          <p className="screener-errors">Couldn't load: {visibleErrors.join(", ")}</p>
        )}
      </div>

      {directoryLoading ? (
        <p className="dashboard-status">Loading NSE symbol list…</p>
      ) : directoryError ? (
        <p className="dashboard-status">Couldn't load the NSE symbol list: {directoryError}</p>
      ) : scanMode && displayedCards.length === 0 ? (
        <p className="dashboard-status">
          {scanState.active ? "Scanning — no matches yet…" : "Scanned everything — no matches for these filters."}
        </p>
      ) : !scanMode && pageLoading && displayedCards.length === 0 ? (
        <p className="dashboard-status">Loading {pageItems.length} stocks…</p>
      ) : !scanMode && displayedCards.length === 0 ? (
        <p className="dashboard-status">No stocks on this page match the current filters.</p>
      ) : (
        <div className="stock-card-grid">
          {displayedCards.map((s) => (
            <StockCard key={s.symbol} snapshot={s} />
          ))}
        </div>
      )}
    </main>
  );
}
