import type { OrderBookSnapshot } from "../types";

// Yahoo Finance's free chart endpoint has no market-depth data, so the
// book is synthesized around the real last-traded price for display only.
export function generateOrderBook(midPrice: number): OrderBookSnapshot {
  const levels = 8;
  const tick = midPrice * 0.0005;
  const bids = Array.from({ length: levels }, (_, i) => ({
    price: midPrice - tick * (i + 1),
    size: Math.round(Math.random() * 50 + 1),
  }));
  const asks = Array.from({ length: levels }, (_, i) => ({
    price: midPrice + tick * (i + 1),
    size: Math.round(Math.random() * 50 + 1),
  }));
  return { bids, asks };
}
