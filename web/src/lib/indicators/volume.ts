// ============================================
//  Volume Indicators — MFI, OBV, CVD, Volume Profile, VWAP
// ============================================
import type { Candle } from '@/types/market';
import { clamp } from './helpers';

export function calcMFI(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  let pos = 0, neg = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const prev = (candles[i - 1].high + candles[i - 1].low + candles[i - 1].close) / 3;
    const mf = tp * (candles[i].volume || 1);
    if (tp > prev) pos += mf; else neg += mf;
  }
  if (neg === 0) return 100;
  return +(100 - 100 / (1 + pos / neg)).toFixed(2);
}

export function calcVWAP(candles: Candle[]): number | null {
  if (candles.length < 2) return null;
  let cumTPV = 0, cumVol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;
    cumTPV += tp * vol;
    cumVol += vol;
  }
  return cumVol === 0 ? null : +(cumTPV / cumVol).toFixed(2);
}

export function calcOBV(candles: Candle[]) {
  if (!candles || candles.length < 2) return null;
  let obv = 0;
  const series = [0];
  for (let i = 1; i < candles.length; i++) {
    const vol = candles[i].volume || 0;
    if (candles[i].close > candles[i - 1].close) obv += vol;
    else if (candles[i].close < candles[i - 1].close) obv -= vol;
    series.push(obv);
  }
  const lb = Math.min(14, series.length - 1);
  const prev = series[series.length - 1 - lb];
  const slope = prev === 0 ? 0 : ((series[series.length - 1] - prev) / Math.abs(prev || 1)) * 100;
  return { value: Math.round(obv), slope: +slope.toFixed(2), trend: slope > 2 ? 'UP' : slope < -2 ? 'DOWN' : 'FLAT' as const };
}

export function calcCVD(candles: Candle[]) {
  if (!candles || candles.length < 2) return null;
  let cvd = 0;
  const series = [0];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const range = Math.max(c.high - c.low, 1e-9);
    const body = Math.abs(c.close - c.open);
    const bw = clamp(body / range + 0.15, 0.15, 1);
    const dir = c.close > c.open ? 1 : c.close < c.open ? -1 : 0;
    cvd += dir * (c.volume || 0) * bw;
    series.push(cvd);
  }
  const lb = Math.min(14, series.length - 1);
  const prev = series[series.length - 1 - lb];
  const slope = prev === 0 ? 0 : ((series[series.length - 1] - prev) / Math.abs(prev || 1)) * 100;
  return { value: Math.round(cvd), slope: +slope.toFixed(2), trend: slope > 2 ? 'UP' : slope < -2 ? 'DOWN' : 'FLAT' as const };
}

export function calcVolumeProfile(candles: Candle[], currentPrice: number, lookback = 120, bins = 24) {
  const slice = candles.slice(-lookback);
  if (slice.length < 10) return null;
  const lo = Math.min(...slice.map((c) => c.low));
  const hi = Math.max(...slice.map((c) => c.high));
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;

  const step = (hi - lo) / bins;
  const volumes = Array<number>(bins).fill(0);
  for (const c of slice) {
    const tp = (c.high + c.low + c.close) / 3;
    volumes[clamp(Math.floor((tp - lo) / step), 0, bins - 1)] += c.volume || 0;
  }

  const total = volumes.reduce((a, b) => a + b, 0) || 1;
  let pocIdx = 0;
  for (let i = 1; i < volumes.length; i++) if (volumes[i] > volumes[pocIdx]) pocIdx = i;

  const entries = volumes.map((v, i) => ({ idx: i, vol: v, price: lo + step * (i + 0.5) }));
  const sorted = [...entries].sort((a, b) => b.vol - a.vol);
  let acc = 0;
  const selected = new Set<number>();
  for (const item of sorted) {
    selected.add(item.idx);
    acc += item.vol;
    if (acc / total >= 0.7) break;
  }

  const selPrices = entries.filter((e) => selected.has(e.idx)).map((e) => e.price);
  const poc = entries[pocIdx].price;
  const vah = selPrices.length > 0 ? Math.max(...selPrices) : poc;
  const val = selPrices.length > 0 ? Math.min(...selPrices) : poc;

  const upper = entries.filter((e) => e.price >= poc).reduce((s, e) => s + e.vol, 0);
  const lower = entries.filter((e) => e.price < poc).reduce((s, e) => s + e.vol, 0);
  const skew = upper > lower * 1.1 ? 'BUY' : lower > upper * 1.1 ? 'SELL' : 'NEUTRAL';

  return { poc: +poc.toFixed(2), vah: +vah.toFixed(2), val: +val.toFixed(2), abovePoc: currentPrice >= poc, skew };
}
