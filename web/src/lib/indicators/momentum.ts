// ============================================
//  Momentum Indicators — RSI, MACD, Stochastic, Williams %R, CCI, StochRSI, RSI Divergence
// ============================================
import type { Candle } from '@/types/market';
import { calcSMA, clamp } from './helpers';
import { calcEMA } from './trend';

export function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);
}

export function calcRSISeries(closes: number[], period = 14): (number | null)[] {
  if (closes.length < period + 1) return [];
  const series: (number | null)[] = Array(closes.length).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  series[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    series[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return series;
}

export function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  if (!emaFast || !emaSlow) return null;
  const offset = slow - fast;
  const macdLine: number[] = [];
  for (let i = 0; i < emaSlow.length; i++) macdLine.push(emaFast[i + offset] - emaSlow[i]);
  const signalLine = calcEMA(macdLine, sig);
  if (!signalLine) return null;
  const ho = macdLine.length - signalLine.length;
  const histogram = signalLine.map((s, i) => macdLine[i + ho] - s);
  return {
    macdLine: +macdLine[macdLine.length - 1].toFixed(4),
    signalLine: +signalLine[signalLine.length - 1].toFixed(4),
    histogram: +histogram[histogram.length - 1].toFixed(4),
    histogramArray: histogram,
  };
}

export function calcStochastic(candles: Candle[], kPeriod = 14, dPeriod = 3) {
  if (candles.length < kPeriod) return null;
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    kValues.push(high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100);
  }
  const dValues = calcSMA(kValues, dPeriod);
  return {
    k: +kValues[kValues.length - 1].toFixed(2),
    d: dValues ? +dValues[dValues.length - 1].toFixed(2) : null,
  };
}

export function calcWilliamsR(candles: Candle[], period = 14): number | null {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const high = Math.max(...slice.map((c) => c.high));
  const low = Math.min(...slice.map((c) => c.low));
  if (high === low) return -50;
  return +((((high - candles[candles.length - 1].close) / (high - low)) * -100).toFixed(2));
}

export function calcCCI(candles: Candle[], period = 20): number | null {
  if (candles.length < period) return null;
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const slice = tp.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const md = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  if (md === 0) return 0;
  return +((tp[tp.length - 1] - mean) / (0.015 * md)).toFixed(2);
}

export function calcStochRSI(closes: number[], rsiP = 14, stochP = 14, sK = 3, sD = 3) {
  const rsiRaw = calcRSISeries(closes, rsiP);
  const rsi = rsiRaw.filter((v): v is number => v !== null);
  if (rsi.length < stochP + sK + sD) return null;

  const raw: number[] = [];
  for (let i = stochP - 1; i < rsi.length; i++) {
    const slice = rsi.slice(i - stochP + 1, i + 1);
    const lo = Math.min(...slice);
    const hi = Math.max(...slice);
    raw.push(hi === lo ? 50 : ((rsi[i] - lo) / (hi - lo)) * 100);
  }

  const kSeries = calcSMA(raw, sK);
  if (!kSeries || kSeries.length < sD) return null;
  const dSeries = calcSMA(kSeries, sD);
  if (!dSeries) return null;

  const k = kSeries[kSeries.length - 1];
  const d = dSeries[dSeries.length - 1];
  let signal: string = 'NEUTRAL';
  if (k > d && k < 80) signal = 'BULLISH';
  else if (k < d && k > 20) signal = 'BEARISH';
  else if (k >= 80) signal = 'OVERBOUGHT';
  else if (k <= 20) signal = 'OVERSOLD';

  return { k: +k.toFixed(2), d: +d.toFixed(2), signal };
}

function findSwingPivots(values: number[], type: 'high' | 'low', window = 2): number[] {
  const pivots: number[] = [];
  for (let i = window; i < values.length - window; i++) {
    let isPivot = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (type === 'high' && values[i] <= values[j]) { isPivot = false; break; }
      if (type === 'low' && values[i] >= values[j]) { isPivot = false; break; }
    }
    if (isPivot) pivots.push(i);
  }
  return pivots;
}

export function detectRSIDivergence(candles: Candle[], rsiSeries: (number | null)[]) {
  if (candles.length < 30 || rsiSeries.length !== candles.length) {
    return { signal: 'NONE', strength: 0, details: 'Insufficient data' };
  }
  const closes = candles.map((c) => c.close);
  const highs = findSwingPivots(closes, 'high', 2).filter((i) => rsiSeries[i] !== null);
  const lows = findSwingPivots(closes, 'low', 2).filter((i) => rsiSeries[i] !== null);

  let bearish: { strength: number; details: string } | null = null;
  let bullish: { strength: number; details: string } | null = null;

  if (highs.length >= 2) {
    const [a, b] = highs.slice(-2);
    const pa = closes[a], pb = closes[b];
    const ra = rsiSeries[a]!, rb = rsiSeries[b]!;
    if (pb > pa && rb < ra) {
      const s = clamp(Math.round(((pb - pa) / pa) * 800 + (ra - rb) * 1.5), 1, 100);
      bearish = { strength: s, details: `HH ${pa.toFixed(2)}->${pb.toFixed(2)} / RSI LH` };
    }
  }
  if (lows.length >= 2) {
    const [a, b] = lows.slice(-2);
    const pa = closes[a], pb = closes[b];
    const ra = rsiSeries[a]!, rb = rsiSeries[b]!;
    if (pb < pa && rb > ra) {
      const s = clamp(Math.round(((pa - pb) / pa) * 800 + (rb - ra) * 1.5), 1, 100);
      bullish = { strength: s, details: `LL ${pa.toFixed(2)}->${pb.toFixed(2)} / RSI HL` };
    }
  }

  if (!bullish && !bearish) return { signal: 'NONE', strength: 0, details: 'No divergence' };
  if (bullish && bearish) {
    return bullish.strength >= bearish.strength
      ? { signal: 'BULLISH', ...bullish }
      : { signal: 'BEARISH', ...bearish };
  }
  if (bullish) return { signal: 'BULLISH', ...bullish };
  return { signal: 'BEARISH', ...bearish! };
}
