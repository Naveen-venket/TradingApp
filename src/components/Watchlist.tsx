import type { Quote } from "../types";
import { displaySymbol, type Symbol } from "../data/yahooFeed";

interface WatchlistProps {
  quotes: Quote[];
  selected: Symbol;
  onSelect: (symbol: Symbol) => void;
}

export default function Watchlist({ quotes, selected, onSelect }: WatchlistProps) {
  return (
    <div className="panel watchlist">
      <h2 className="panel-title">Watchlist</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Chg %</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr
              key={q.symbol}
              className={q.symbol === selected ? "row-selected" : ""}
              onClick={() => onSelect(q.symbol as Symbol)}
            >
              <td>{displaySymbol(q.symbol as Symbol)}</td>
              <td>{q.price.toFixed(2)}</td>
              <td className={q.changePct >= 0 ? "positive" : "negative"}>
                {q.changePct >= 0 ? "+" : ""}
                {q.changePct.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
