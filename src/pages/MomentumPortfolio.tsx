import { useEffect, useMemo, useState } from "react";
import {
  CURATED_UNIVERSE,
  fetchMomentumSnapshot,
  type MomentumSnapshot,
} from "../data/momentumStrategy";
import "./MomentumPortfolio.css";

const PORTFOLIO_SIZE = 20;

function TagPill({ tag }: { tag: MomentumSnapshot["tag"] }) {
  const label = tag === "entry" ? "Entry" : tag === "exit" ? "Exit" : "Neutral";
  return <span className={`tag-pill tag-${tag}`}>{label}</span>;
}

function fmt(n: number | null, digits = 1): string {
  return n === null ? "–" : n.toFixed(digits);
}

export default function MomentumPortfolio() {
  const [snapshots, setSnapshots] = useState<MomentumSnapshot[]>([]);
  const [errors, setErrors] = useState<{ symbol: string; message: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const results = await Promise.allSettled(CURATED_UNIVERSE.map((s) => fetchMomentumSnapshot(s)));
    const ok: MomentumSnapshot[] = [];
    const failed: { symbol: string; message: string }[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.push(r.value);
      else failed.push({ symbol: CURATED_UNIVERSE[i].symbol, message: r.reason?.message ?? "Failed to load" });
    });
    setSnapshots(ok);
    setErrors(failed);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const { ranked, excluded } = useMemo(() => {
    const eligible = snapshots.filter((s) => s.volumePass && s.avgRsi !== null);
    const notEligible = snapshots.filter((s) => !s.volumePass || s.avgRsi === null);
    eligible.sort((a, b) => b.avgRsi! - a.avgRsi!);
    return { ranked: eligible, excluded: notEligible };
  }, [snapshots]);

  const portfolio = ranked.slice(0, PORTFOLIO_SIZE);
  const entryCount = portfolio.filter((s) => s.tag === "entry").length;
  const exitCount = portfolio.filter((s) => s.tag === "exit").length;
  const weight = portfolio.length > 0 ? (100 / PORTFOLIO_SIZE).toFixed(1) : "0";

  return (
    <main className="momentum-page">
      <div className="panel momentum-intro">
        <h2 className="panel-title">Momentum portfolio</h2>
        <p className="checklist-note">
          Step 1 (Mcap &gt; ₹1,000 Cr) is approximated with a curated large/mid-cap universe of{" "}
          {CURATED_UNIVERSE.length} stocks — no free live market-cap source exists (see the
          Screener page for why). Step 2 excludes anything with 20-day average volume ≤ 50,000
          shares. Remaining stocks are ranked by avg RSI(22, 44, 66) — Step 3/4 — and the top{" "}
          {PORTFOLIO_SIZE} get an equal {weight}% weight (Step 5). Signal{" "}
          <strong>A = %(RSI periods &gt; 60) − %(RSI periods &lt; 40)</strong>; tagged{" "}
          <strong>Entry</strong> when A &gt; +5, <strong>Exit</strong> when A &lt; −5.
        </p>
        {!loading && (
          <div className="momentum-summary">
            <span className="scorecard-line">{portfolio.length} in portfolio</span>
            <span className="scorecard-line">{entryCount} entry signals</span>
            <span className="scorecard-line">{exitCount} exit signals</span>
            <span className="scorecard-line">{excluded.length} excluded (volume/history)</span>
            <button className="refresh-button" onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>
        )}
        {errors.length > 0 && (
          <p className="screener-errors">Couldn't load: {errors.map((e) => e.symbol).join(", ")}</p>
        )}
      </div>

      {loading ? (
        <p className="dashboard-status">Loading momentum data for {CURATED_UNIVERSE.length} stocks…</p>
      ) : (
        <div className="panel momentum-table-panel">
          <div className="momentum-table-scroll">
            <table className="momentum-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Chg %</th>
                  <th>20D Avg Vol</th>
                  <th>RSI22</th>
                  <th>RSI44</th>
                  <th>RSI66</th>
                  <th>Avg RSI</th>
                  <th>Signal A</th>
                  <th>Tag</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, i) => {
                  const rank = i + 1;
                  const inPortfolio = rank <= PORTFOLIO_SIZE;
                  return (
                    <tr key={s.symbol} className={inPortfolio ? "row-in-portfolio" : ""}>
                      <td>{rank}</td>
                      <td className="cell-stock">
                        <div className="stock-symbol-sm">{s.symbol}</div>
                        <div className="stock-name-sm">{s.name}</div>
                      </td>
                      <td>₹{s.price.toFixed(2)}</td>
                      <td className={s.changePct >= 0 ? "positive" : "negative"}>
                        {s.changePct >= 0 ? "+" : ""}
                        {s.changePct.toFixed(2)}%
                      </td>
                      <td>{s.avgVolume20Value ? Math.round(s.avgVolume20Value).toLocaleString("en-IN") : "–"}</td>
                      <td>{fmt(s.rsi22, 0)}</td>
                      <td>{fmt(s.rsi44, 0)}</td>
                      <td>{fmt(s.rsi66, 0)}</td>
                      <td>{fmt(s.avgRsi, 1)}</td>
                      <td>{fmt(s.signal, 0)}</td>
                      <td>
                        <TagPill tag={s.tag} />
                      </td>
                      <td>{inPortfolio ? `${weight}%` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {excluded.length > 0 && (
            <div className="momentum-excluded">
              <h3 className="panel-title">Excluded ({excluded.length})</h3>
              <p className="checklist-note">
                Failed Step 2's volume filter or don't have enough trading history yet for the
                RSI(22/44/66) calculation.
              </p>
              <div className="excluded-list">
                {excluded.map((s) => (
                  <span key={s.symbol} className="excluded-chip">
                    {s.symbol} — {!s.volumePass ? "low volume" : "insufficient history"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
