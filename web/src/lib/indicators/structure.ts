// ============================================
//  Structure Indicators — Order Blocks, FVGs, Fibonacci, Pivot Points, Patterns
// ============================================
import type { Candle } from '@/types/market';

export function calcPivotPoints(candles: Candle[]) {
  if (candles.length < 2) return null;
  const prev = candles[candles.length - 2];
  const pivot = (prev.high + prev.low + prev.close) / 3;
  const range = prev.high - prev.low;
  return {
    r3: +(pivot + 2 * range).toFixed(2),
    r2: +(pivot + range).toFixed(2),
    r1: +(2 * pivot - prev.low).toFixed(2),
    pivot: +pivot.toFixed(2),
    s1: +(2 * pivot - prev.high).toFixed(2),
    s2: +(pivot - range).toFixed(2),
    s3: +(pivot - 2 * range).toFixed(2),
  };
}

export function detectOrderBlocks(candles: Candle[], atr: number | null) {
  if (!candles || candles.length < 20) return [];
  const zones: { type: 'BULLISH' | 'BEARISH'; low: number; high: number; age: number }[] = [];
  const threshold = atr ? atr * 0.8 : candles[candles.length - 1].close * 0.0015;
  const start = Math.max(5, candles.length - 120);

  for (let i = start; i < candles.length - 3; i++) {
    const c = candles[i];
    const next = candles.slice(i + 1, i + 4);
    const prev = candles.slice(Math.max(0, i - 5), i);
    if (next.length < 3 || prev.length < 3) continue;

    const prevHigh = Math.max(...prev.map((x) => x.high));
    const prevLow = Math.min(...prev.map((x) => x.low));
    const lastClose = next[next.length - 1].close;

    if (c.close < c.open && next.some((n) => n.close > prevHigh) && lastClose - c.close > threshold) {
      zones.push({ type: 'BULLISH', low: +c.low.toFixed(2), high: +Math.max(c.open, c.close).toFixed(2), age: candles.length - 1 - i });
    }
    if (c.close > c.open && next.some((n) => n.close < prevLow) && c.close - lastClose > threshold) {
      zones.push({ type: 'BEARISH', low: +Math.min(c.open, c.close).toFixed(2), high: +c.high.toFixed(2), age: candles.length - 1 - i });
    }
  }
  return zones.slice(-8);
}

export function detectFVGs(candles: Candle[]) {
  if (!candles || candles.length < 5) return [];
  const gaps: { type: 'BULLISH' | 'BEARISH'; low: number; high: number; age: number }[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];
    if (prev.high < next.low) {
      gaps.push({ type: 'BULLISH', low: +prev.high.toFixed(2), high: +next.low.toFixed(2), age: candles.length - 1 - i });
    }
    if (prev.low > next.high) {
      gaps.push({ type: 'BEARISH', low: +next.high.toFixed(2), high: +prev.low.toFixed(2), age: candles.length - 1 - i });
    }
  }
  return gaps.slice(-10);
}

export function calcFibonacciStructure(candles: Candle[], currentPrice: number) {
  const slice = candles.slice(-160);
  if (slice.length < 20) return null;
  let swingHigh = -Infinity, swingLow = Infinity, hiIdx = -1, loIdx = -1;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i].high > swingHigh) { swingHigh = slice[i].high; hiIdx = i; }
    if (slice[i].low < swingLow) { swingLow = slice[i].low; loIdx = i; }
  }
  if (!Number.isFinite(swingHigh) || !Number.isFinite(swingLow) || swingHigh <= swingLow) return null;

  const trend = hiIdx > loIdx ? 'UP' : loIdx > hiIdx ? 'DOWN' : 'RANGE';
  const range = swingHigh - swingLow;
  const fibs = [0.236, 0.382, 0.5, 0.618, 0.786] as const;
  const levels: Record<string, number> = {};
  for (const f of fibs) {
    levels[String(f)] = +(trend === 'DOWN' ? swingLow + range * f : swingHigh - range * f).toFixed(2);
  }

  const entries = Object.entries(levels).map(([name, price]) => ({ name, price }));
  entries.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

  const gpMin = Math.min(levels['0.5'], levels['0.618']);
  const gpMax = Math.max(levels['0.5'], levels['0.618']);

  return {
    trend,
    swingHigh: +swingHigh.toFixed(2),
    swingLow: +swingLow.toFixed(2),
    levels,
    nearestLevel: entries[0]?.name || null,
    nearestPrice: entries[0] ? +entries[0].price.toFixed(2) : null,
    inGoldenPocket: currentPrice >= gpMin && currentPrice <= gpMax,
  };
}

export function detectPatterns(candles: Candle[]) {
  if (candles.length < 3) return [];
  const patterns: { name: string; type: 'bullish' | 'bearish' | 'neutral'; emoji: string }[] = [];
  const c = candles[candles.length - 1];
  const p = candles[candles.length - 2];
  const pp = candles[candles.length - 3];
  const body = Math.abs(c.close - c.open);
  const uWick = c.high - Math.max(c.open, c.close);
  const lWick = Math.min(c.open, c.close) - c.low;
  const range = c.high - c.low;

  if (body < range * 0.1 && range > 0) patterns.push({ name: 'Doji', type: 'neutral', emoji: '⚖️' });
  if (lWick > body * 2 && uWick < body * 0.5 && body > 0) patterns.push({ name: 'Hammer', type: 'bullish', emoji: '🔨' });
  if (uWick > body * 2 && lWick < body * 0.5 && body > 0) patterns.push({ name: 'Shooting Star', type: 'bearish', emoji: '⭐' });
  if (p.close < p.open && c.close > c.open && c.close > p.open && c.open < p.close) patterns.push({ name: 'Bullish Engulfing', type: 'bullish', emoji: '🟢' });
  if (p.close > p.open && c.close < c.open && c.close < p.open && c.open > p.close) patterns.push({ name: 'Bearish Engulfing', type: 'bearish', emoji: '🔴' });

  const ppBody = Math.abs(pp.close - pp.open);
  const pBody = Math.abs(p.close - p.open);
  if (pp.close < pp.open && pBody < ppBody * 0.3 && c.close > c.open && c.close > (pp.open + pp.close) / 2) patterns.push({ name: 'Morning Star', type: 'bullish', emoji: '🌅' });
  if (pp.close > pp.open && pBody < ppBody * 0.3 && c.close < c.open && c.close < (pp.open + pp.close) / 2) patterns.push({ name: 'Evening Star', type: 'bearish', emoji: '🌆' });

  return patterns;
}
