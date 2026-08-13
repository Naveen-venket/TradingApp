import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import FundamentalsChecklist from "./pages/FundamentalsChecklist";
import Screener from "./pages/Screener";
import MomentumPortfolio from "./pages/MomentumPortfolio";
import "./App.css";

type Page = "dashboard" | "fundamentals" | "screener" | "momentum";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="app">
      <header className="app-header">
        <h1>TradingApp</h1>
        <span className="subtitle">NSE live prices via Yahoo Finance · order book simulated</span>
        <nav className="app-nav">
          <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>
            Dashboard
          </button>
          <button className={page === "screener" ? "active" : ""} onClick={() => setPage("screener")}>
            Screener
          </button>
          <button className={page === "momentum" ? "active" : ""} onClick={() => setPage("momentum")}>
            Momentum Portfolio
          </button>
          <button className={page === "fundamentals" ? "active" : ""} onClick={() => setPage("fundamentals")}>
            Fundamentals Checklist
          </button>
        </nav>
      </header>
      {page === "dashboard" && <Dashboard />}
      {page === "screener" && <Screener />}
      {page === "momentum" && <MomentumPortfolio />}
      {page === "fundamentals" && <FundamentalsChecklist />}
    </div>
  );
}
