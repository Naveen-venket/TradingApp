import type { OrderBookSnapshot } from "../types";

interface OrderBookProps {
  book: OrderBookSnapshot;
}

export default function OrderBook({ book }: OrderBookProps) {
  return (
    <div className="panel order-book">
      <h2 className="panel-title">Order Book</h2>
      <div className="order-book-columns">
        <table>
          <thead>
            <tr>
              <th>Bid Size</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {book.bids.map((level) => (
              <tr key={level.price}>
                <td>{level.size}</td>
                <td className="positive">{level.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th>Ask Size</th>
            </tr>
          </thead>
          <tbody>
            {book.asks.map((level) => (
              <tr key={level.price}>
                <td className="negative">{level.price.toFixed(2)}</td>
                <td>{level.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
