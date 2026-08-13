export function lastDefined(values: number[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (!Number.isNaN(values[i])) return values[i];
  }
  return null;
}

export function sma(values: number[], period: number): number | null {
  const clean = values.filter((v) => !Number.isNaN(v));
  if (clean.length < period) return null;
  const slice = clean.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// Wilder's smoothing RSI, aligned to `closes` (leading entries are NaN
// until enough data has accumulated).
export function computeRSISeries(closes: number[], period: number): number[] {
  const rsi = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gainSum += delta;
    else lossSum -= delta;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}
