import { useMemo, useState, type ReactNode } from "react";
import Badge, { type BadgeStatus } from "../components/Badge";
import "./FundamentalsChecklist.css";

const YEAR_LABELS = ["5 yrs ago", "4 yrs ago", "3 yrs ago", "2 yrs ago", "Latest"];

function cagr(first: number, last: number, periods: number): number | null {
  if (first <= 0 || last <= 0) return null;
  return (Math.pow(last / first, 1 / periods) - 1) * 100;
}

function decliningYears(series: number[]): number {
  let count = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i] < series[i - 1]) count++;
  }
  return count;
}

function YearSeriesInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: number[];
  onChange: (next: number[]) => void;
}) {
  return (
    <div className="field-group">
      <span className="field-group-label">{label}</span>
      <div className="year-inputs">
        {values.map((v, i) => (
          <label key={i} className="year-input">
            <span>{YEAR_LABELS[i]}</span>
            <input
              type="number"
              value={v}
              onChange={(e) => {
                const next = [...values];
                next[i] = Number(e.target.value);
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div className="number-field-input">
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </label>
  );
}

interface Section {
  title: string;
  status: BadgeStatus;
  note: string;
  children: ReactNode;
}

function SectionCard({ title, status, note, children }: Section) {
  return (
    <div className="panel checklist-section">
      <div className="checklist-section-header">
        <h2 className="panel-title">{title}</h2>
        <Badge status={status} />
      </div>
      <p className="checklist-note">{note}</p>
      <div className="checklist-fields">{children}</div>
    </div>
  );
}

export default function FundamentalsChecklist() {
  // 1. Growth
  const [revenue, setRevenue] = useState([0, 0, 0, 0, 0]);
  const [profit, setProfit] = useState([0, 0, 0, 0, 0]);

  // 2. Is the profit real?
  const [opmTrend, setOpmTrend] = useState<"expanding" | "stable" | "shrinking">("stable");
  const [netProfit, setNetProfit] = useState(0);
  const [cfo, setCfo] = useState(0);

  // 3. Debt
  const [isBankOrNbfc, setIsBankOrNbfc] = useState(false);
  const [debtToEquity, setDebtToEquity] = useState(0);
  const [interestCoverage, setInterestCoverage] = useState(0);

  // 4. Capital efficiency
  const [roe, setRoe] = useState(0);
  const [roce, setRoce] = useState(0);

  // 5. Valuation
  const [currentPE, setCurrentPE] = useState(0);
  const [historicalAvgPE, setHistoricalAvgPE] = useState(0);
  const [industryPE, setIndustryPE] = useState(0);
  const [growthRatePct, setGrowthRatePct] = useState(0);

  // 6. Ownership & governance
  const [promoterNow, setPromoterNow] = useState(0);
  const [promoterPast, setPromoterPast] = useState(0);
  const [pledgePct, setPledgePct] = useState(0);
  const [auditorResigned, setAuditorResigned] = useState(false);
  const [frequentCfoChanges, setFrequentCfoChanges] = useState(false);
  const [relatedPartyFlag, setRelatedPartyFlag] = useState(false);

  const growth = useMemo(() => {
    const revenueCagr = cagr(revenue[0], revenue[4], 4);
    const profitCagr = cagr(profit[0], profit[4], 4);
    const revenueDowns = decliningYears(revenue);
    const profitDowns = decliningYears(profit);

    let status: BadgeStatus = "info";
    let verdict = "Enter 5 years of revenue and net profit to evaluate.";
    if (revenueCagr !== null && profitCagr !== null) {
      if (revenueCagr > 0 && revenueDowns === 0 && profitCagr > 0 && profitDowns === 0) {
        status = "good";
        verdict = "Consistent upward trend in both revenue and profit.";
      } else if (revenueCagr <= 0 && profitCagr > 0) {
        status = "bad";
        verdict = "Profit is growing while revenue isn't — check for cost-cutting driving the gain.";
      } else if (revenueDowns > 0 || profitDowns > 0) {
        status = "warn";
        verdict = `Lumpy trend: revenue declined in ${revenueDowns} of 4 years, profit in ${profitDowns}.`;
      } else {
        status = "warn";
        verdict = "Growth is positive but not clearly consistent — review the underlying years.";
      }
    }
    return { status, verdict, revenueCagr, profitCagr };
  }, [revenue, profit]);

  const profitQuality = useMemo(() => {
    const cfoToNp = netProfit !== 0 ? cfo / netProfit : null;
    let status: BadgeStatus = "info";
    let verdict = "Enter net profit and operating cash flow to evaluate.";
    if (cfoToNp !== null) {
      if (opmTrend !== "shrinking" && cfoToNp >= 0.8) {
        status = "good";
        verdict = "Margins holding up and cash flow tracks profit — earnings look real.";
      } else if (opmTrend === "shrinking" || cfoToNp < 0.5) {
        status = "bad";
        verdict =
          cfoToNp < 0.5
            ? "Operating cash flow is well below net profit — earnings may be stuck in receivables."
            : "Operating margin is shrinking — pricing power may be eroding.";
      } else {
        status = "warn";
        verdict = "Partially consistent — keep an eye on the margin and cash flow gap.";
      }
    }
    return { status, verdict, cfoToNp };
  }, [opmTrend, netProfit, cfo]);

  const debt = useMemo(() => {
    if (isBankOrNbfc) {
      return {
        status: "info" as BadgeStatus,
        verdict: "Bank/NBFC selected — D/E and interest coverage don't apply; use sector-specific metrics (NPA, CAR, NIM).",
      };
    }
    let status: BadgeStatus = "info";
    let verdict = "Enter debt-to-equity and interest coverage to evaluate.";
    if (debtToEquity > 0 || interestCoverage > 0) {
      if (debtToEquity < 1 && interestCoverage >= 4) {
        status = "good";
        verdict = "Leverage is comfortable and interest is well covered by operating profit.";
      } else if (debtToEquity >= 2 || interestCoverage < 2) {
        status = "bad";
        verdict = "Debt load or interest coverage looks stretched.";
      } else {
        status = "warn";
        verdict = "Debt is manageable but not comfortably so — watch the trend.";
      }
    }
    return { status, verdict };
  }, [isBankOrNbfc, debtToEquity, interestCoverage]);

  const capitalEfficiency = useMemo(() => {
    let status: BadgeStatus = "info";
    let verdict = "Enter ROE and ROCE to evaluate.";
    if (roe > 0 || roce > 0) {
      if (roe >= 15 && roce >= 15) {
        status = "good";
        verdict = "Both ROE and ROCE clear ~15%, and ROCE confirms it isn't leverage alone.";
      } else if (roe >= 15 && roce < 10) {
        status = "warn";
        verdict = "ROE looks strong but ROCE lags well behind — high ROE may be leverage-driven.";
      } else if (roe < 10 && roce < 10) {
        status = "bad";
        verdict = "Both returns are weak — capital isn't being used efficiently.";
      } else {
        status = "warn";
        verdict = "Returns are middling — compare against sector peers.";
      }
    }
    return { status, verdict };
  }, [roe, roce]);

  const valuation = useMemo(() => {
    const peg = growthRatePct > 0 && currentPE > 0 ? currentPE / growthRatePct : null;
    const vsHistory =
      historicalAvgPE > 0 ? ((currentPE - historicalAvgPE) / historicalAvgPE) * 100 : null;
    const vsIndustry = industryPE > 0 ? ((currentPE - industryPE) / industryPE) * 100 : null;
    let pegLabel = "";
    if (peg !== null) {
      if (peg < 1) pegLabel = "PEG under 1 — growth may be undervalued.";
      else if (peg <= 2) pegLabel = "PEG 1-2 — roughly fair value for the growth rate.";
      else pegLabel = "PEG above 2 — priced for a lot of growth to still happen.";
    }
    return { peg, pegLabel, vsHistory, vsIndustry };
  }, [currentPE, historicalAvgPE, industryPE, growthRatePct]);

  const ownership = useMemo(() => {
    const redFlags = [auditorResigned, frequentCfoChanges, relatedPartyFlag].filter(Boolean).length;
    let status: BadgeStatus = "info";
    let verdict = "Enter promoter holding and pledge data to evaluate.";
    if (promoterNow > 0 || promoterPast > 0 || pledgePct > 0) {
      if (promoterNow >= promoterPast && pledgePct < 5 && redFlags === 0) {
        status = "good";
        verdict = "Promoter holding steady or rising, low pledging, no governance flags.";
      } else if (pledgePct > 25 || redFlags > 0) {
        status = "bad";
        verdict = "Real governance risk here — high pledging and/or flagged events.";
      } else {
        status = "warn";
        verdict = "Some caution warranted — check the disclosures behind the numbers.";
      }
    }
    return { status, verdict, redFlags };
  }, [promoterNow, promoterPast, pledgePct, auditorResigned, frequentCfoChanges, relatedPartyFlag]);

  const scorecard = useMemo(() => {
    const scored = [growth.status, profitQuality.status, debt.status, capitalEfficiency.status, ownership.status];
    const good = scored.filter((s) => s === "good").length;
    const bad = scored.filter((s) => s === "bad").length;
    const answered = scored.filter((s) => s !== "info").length;
    return { good, bad, answered, total: scored.length };
  }, [growth.status, profitQuality.status, debt.status, capitalEfficiency.status, ownership.status]);

  return (
    <main className="checklist-page">
      <div className="checklist-intro panel">
        <h2 className="panel-title">Quality-of-business checklist</h2>
        <p className="checklist-note">
          Fill in figures from the annual report / screener for one company at a time. This is a
          framework for asking the right questions, not a buy/sell signal — valuation especially
          should be read in context, not as a pass/fail.
        </p>
        {scorecard.answered > 0 && (
          <div className="scorecard">
            <span className="scorecard-line">
              {scorecard.good}/{scorecard.total} sections green
              {scorecard.bad > 0 ? `, ${scorecard.bad} flagged weak` : ""}
            </span>
          </div>
        )}
      </div>

      <SectionCard
        title="1. Is the business growing?"
        status={growth.status}
        note="Five years of revenue and net profit. Want a consistent upward trend, not one good year — lumpy or declining revenue with rising profit often means cost-cutting, which runs out."
      >
        <YearSeriesInput label="Revenue" values={revenue} onChange={setRevenue} />
        <YearSeriesInput label="Net profit" values={profit} onChange={setProfit} />
        <p className="computed">
          {growth.revenueCagr !== null && `Revenue CAGR: ${growth.revenueCagr.toFixed(1)}%`}
          {growth.revenueCagr !== null && growth.profitCagr !== null && " · "}
          {growth.profitCagr !== null && `Profit CAGR: ${growth.profitCagr.toFixed(1)}%`}
        </p>
        <p className="verdict">{growth.verdict}</p>
      </SectionCard>

      <SectionCard
        title="2. Is the profit real?"
        status={profitQuality.status}
        note="Operating margin should be stable or expanding, not steadily shrinking. Cash flow from operations should roughly track net profit — if profit rises but CFO doesn't, earnings may be sitting in receivables rather than the bank."
      >
        <label className="select-field">
          <span>Operating margin (OPM) trend</span>
          <select value={opmTrend} onChange={(e) => setOpmTrend(e.target.value as typeof opmTrend)}>
            <option value="expanding">Expanding</option>
            <option value="stable">Stable</option>
            <option value="shrinking">Shrinking</option>
          </select>
        </label>
        <NumberField label="Latest net profit" value={netProfit} onChange={setNetProfit} />
        <NumberField label="Latest cash flow from operations" value={cfo} onChange={setCfo} />
        <p className="computed">
          {profitQuality.cfoToNp !== null && `CFO / Net profit: ${profitQuality.cfoToNp.toFixed(2)}x`}
        </p>
        <p className="verdict">{profitQuality.verdict}</p>
      </SectionCard>

      <SectionCard
        title="3. How much debt?"
        status={debt.status}
        note="Debt-to-equity under 1 is comfortable for most industries — banks and NBFCs need separate metrics. Interest coverage (operating profit ÷ interest expense) above 3-4x means debt is manageable."
      >
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={isBankOrNbfc}
            onChange={(e) => setIsBankOrNbfc(e.target.checked)}
          />
          <span>This is a bank / NBFC (skip D/E and interest coverage)</span>
        </label>
        {!isBankOrNbfc && (
          <>
            <NumberField label="Debt-to-equity" value={debtToEquity} onChange={setDebtToEquity} />
            <NumberField
              label="Interest coverage"
              value={interestCoverage}
              suffix="x"
              onChange={setInterestCoverage}
            />
          </>
        )}
        <p className="verdict">{debt.verdict}</p>
      </SectionCard>

      <SectionCard
        title="4. How well is capital used?"
        status={capitalEfficiency.status}
        note="ROE and ROCE consistently above ~15% suggests a quality business. Check ROE isn't just high because of heavy leverage — ROCE is the cross-check."
      >
        <NumberField label="ROE" value={roe} suffix="%" onChange={setRoe} />
        <NumberField label="ROCE" value={roce} suffix="%" onChange={setRoce} />
        <p className="verdict">{capitalEfficiency.verdict}</p>
      </SectionCard>

      <SectionCard
        title="5. Is the price sane?"
        status="info"
        note="Compare P/E to the company's own historical range and its industry peers, not the market as a whole. PEG (P/E ÷ growth rate) gives a rough sense of whether growth justifies the multiple. Valuation tells you nothing in isolation — a P/E of 60 can be fine and a P/E of 8 can be a value trap."
      >
        <NumberField label="Current P/E" value={currentPE} onChange={setCurrentPE} />
        <NumberField label="Own 5-yr average P/E" value={historicalAvgPE} onChange={setHistoricalAvgPE} />
        <NumberField label="Industry P/E" value={industryPE} onChange={setIndustryPE} />
        <NumberField
          label="Expected earnings growth rate"
          value={growthRatePct}
          suffix="%"
          onChange={setGrowthRatePct}
        />
        <p className="computed">
          {valuation.peg !== null && `PEG: ${valuation.peg.toFixed(2)}`}
          {valuation.vsHistory !== null &&
            ` · ${valuation.vsHistory >= 0 ? "+" : ""}${valuation.vsHistory.toFixed(0)}% vs own history`}
          {valuation.vsIndustry !== null &&
            ` · ${valuation.vsIndustry >= 0 ? "+" : ""}${valuation.vsIndustry.toFixed(0)}% vs industry`}
        </p>
        <p className="verdict">{valuation.pegLabel || "Enter figures to see PEG and relative valuation."}</p>
      </SectionCard>

      <SectionCard
        title="6. Ownership and governance"
        status={ownership.status}
        note="Promoter holding rising or steady is reassuring; falling is worth investigating. High pledged shares is a genuine risk flag in Indian markets. Also check auditor resignations, frequent CFO changes, or related-party transactions."
      >
        <NumberField label="Promoter holding now" value={promoterNow} suffix="%" onChange={setPromoterNow} />
        <NumberField
          label="Promoter holding 3 yrs ago"
          value={promoterPast}
          suffix="%"
          onChange={setPromoterPast}
        />
        <NumberField label="Pledged (% of promoter holding)" value={pledgePct} suffix="%" onChange={setPledgePct} />
        <label className="checkbox-field">
          <input type="checkbox" checked={auditorResigned} onChange={(e) => setAuditorResigned(e.target.checked)} />
          <span>Auditor resigned recently</span>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={frequentCfoChanges}
            onChange={(e) => setFrequentCfoChanges(e.target.checked)}
          />
          <span>Frequent CFO changes</span>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={relatedPartyFlag}
            onChange={(e) => setRelatedPartyFlag(e.target.checked)}
          />
          <span>Significant related-party transactions</span>
        </label>
        <p className="verdict">{ownership.verdict}</p>
      </SectionCard>
    </main>
  );
}
