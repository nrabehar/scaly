// ============================================
//  Trend Indicators — EMA, ADX, Ichimoku
// ============================================
import type { Candle } from '@/types/market';
import { calcSMA } from './helpers';

export function calcEMA(data: number[], period: number): number[] | null {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [ema];
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

export function calcADX(candles: Candle[], period = 14) {
  if (candles.length < period * 2 + 1) return null;

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close),
      ),
    );
  }

  let smoothTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: { dx: number; plusDI: number; minusDI: number }[] = [];
  for (let i = period; i < tr.length; i++) {
    smoothTR = smoothTR - smoothTR / period + tr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];

    const plusDI = (smoothPlusDM / smoothTR) * 100;
    const minusDI = (smoothMinusDM / smoothTR) * 100;
    const diSum = plusDI + minusDI;
    const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;
    dxValues.push({ dx, plusDI, minusDI });
  }

  if (dxValues.length < period) return null;
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b.dx, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i].dx) / period;
  }

  const last = dxValues[dxValues.length - 1];
  return {
    adx: +adx.toFixed(2),
    plusDI: +last.plusDI.toFixed(2),
    minusDI: +last.minusDI.toFixed(2),
    trendStrength:
      adx > 50 ? 'VERY_STRONG' : adx > 25 ? 'STRONG' : adx > 20 ? 'DEVELOPING' : 'WEAK',
  };
}

export function calcIchimoku(candles: Candle[], currentPrice: number) {
  if (!candles || candles.length < 26) return null;

  const midpoint = (period: number) => {
    if (candles.length < period) return null;
    const slice = candles.slice(-period);
    return (Math.max(...slice.map((c) => c.high)) + Math.min(...slice.map((c) => c.low))) / 2;
  };

  const tenkan = midpoint(9);
  const kijun = midpoint(26);
  const spanB = midpoint(52);
  const spanA = tenkan !== null && kijun !== null ? (tenkan + kijun) / 2 : null;

  if (tenkan === null || kijun === null || spanA === null || spanB === null) {
    return { tenkan, kijun, spanA, spanB, cloudTop: null, cloudBottom: null, signal: 'NEUTRAL' as const, strength: 0 };
  }

  const cloudTop = Math.max(spanA, spanB);
  const cloudBottom = Math.min(spanA, spanB);

  let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let strength = 50;
  if (currentPrice > cloudTop && tenkan > kijun) {
    signal = 'BULLISH';
    strength = 70 + (tenkan > spanA ? 10 : 0);
  } else if (currentPrice < cloudBottom && tenkan < kijun) {
    signal = 'BEARISH';
    strength = 70 + (tenkan < spanB ? 10 : 0);
  } else if (currentPrice > kijun) {
    signal = 'BULLISH';
    strength = 58;
  } else if (currentPrice < kijun) {
    signal = 'BEARISH';
    strength = 58;
  }

  return {
    tenkan: +tenkan.toFixed(2),
    kijun: +kijun.toFixed(2),
    spanA: +spanA.toFixed(2),
    spanB: +spanB.toFixed(2),
    cloudTop: +cloudTop.toFixed(2),
    cloudBottom: +cloudBottom.toFixed(2),
    signal,
    strength,
  };
}

export function determineTrend(indicators: Record<string, any>, currentPrice: number) {
  let bullishCount = 0;
  let bearishCount = 0;
  let totalSignals = 0;
  const reasons: string[] = [];

  if (indicators.ema9 !== null && indicators.ema21 !== null) {
    totalSignals++;
    if (indicators.ema9 > indicators.ema21) { bullishCount++; reasons.push('EMA 9 > 21 ↑'); }
    else { bearishCount++; reasons.push('EMA 9 < 21 ↓'); }
  }
  if (indicators.ema50 !== null && indicators.ema200 !== null) {
    totalSignals++;
    if (indicators.ema50 > indicators.ema200) { bullishCount++; reasons.push('Golden Cross ↑'); }
    else { bearishCount++; reasons.push('Death Cross ↓'); }
  }
  if (indicators.ema50 !== null) {
    totalSignals++;
    if (currentPrice > indicators.ema50) { bullishCount++; reasons.push('Price > EMA50 ↑'); }
    else { bearishCount++; reasons.push('Price < EMA50 ↓'); }
  }
  if (indicators.macdLine !== null && indicators.macdSignal !== null) {
    totalSignals++;
    if (indicators.macdLine > indicators.macdSignal) { bullishCount++; reasons.push('MACD Bullish ↑'); }
    else { bearishCount++; reasons.push('MACD Bearish ↓'); }
  }
  if (indicators.rsi !== null) {
    totalSignals++;
    if (indicators.rsi > 50) { bullishCount++; reasons.push(`RSI ${indicators.rsi} > 50 ↑`); }
    else { bearishCount++; reasons.push(`RSI ${indicators.rsi} < 50 ↓`); }
  }
  if (indicators.adx) {
    totalSignals++;
    if (indicators.adx.plusDI > indicators.adx.minusDI) { bullishCount++; reasons.push('ADX +DI > -DI ↑'); }
    else { bearishCount++; reasons.push('ADX +DI < -DI ↓'); }
  }
  if (indicators.stochastic) {
    totalSignals++;
    if (indicators.stochastic.k > 50) { bullishCount++; reasons.push(`Stoch %K ${indicators.stochastic.k} ↑`); }
    else { bearishCount++; reasons.push(`Stoch %K ${indicators.stochastic.k} ↓`); }
  }
  if (indicators.vwap && currentPrice) {
    totalSignals++;
    if (currentPrice > indicators.vwap) { bullishCount++; reasons.push('Price > VWAP ↑'); }
    else { bearishCount++; reasons.push('Price < VWAP ↓'); }
  }

  const bullishPct = totalSignals > 0 ? Math.round((bullishCount / totalSignals) * 100) : 50;
  const bearishPct = 100 - bullishPct;

  let direction: string;
  let strength: string;
  if (bullishPct >= 75) { direction = 'BULLISH'; strength = 'STRONG'; }
  else if (bullishPct >= 60) { direction = 'BULLISH'; strength = 'MODERATE'; }
  else if (bearishPct >= 75) { direction = 'BEARISH'; strength = 'STRONG'; }
  else if (bearishPct >= 60) { direction = 'BEARISH'; strength = 'MODERATE'; }
  else { direction = 'NEUTRAL'; strength = 'WEAK'; }

  return { direction, strength, bullishPct, bearishPct, bullishCount, bearishCount, totalSignals, reasons };
}

/**
 * Local multi-timeframe confluence from aggregated candles
 */
export function calcLocalMTFConfluence(candles: Candle[]) {
  const aggregate = (data: Candle[], m: number): Candle[] => {
    if (m <= 1) return data.slice();
    const out: Candle[] = [];
    for (let i = 0; i < data.length; i += m) {
      const chunk = data.slice(i, i + m);
      if (chunk.length < Math.max(2, Math.floor(m * 0.6))) continue;
      out.push({
        open: chunk[0].open,
        high: Math.max(...chunk.map((c) => c.high)),
        low: Math.min(...chunk.map((c) => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((s, c) => s + (c.volume || 0), 0),
        time: chunk[chunk.length - 1].time,
      });
    }
    return out;
  };

  const evalSignal = (data: Candle[]): 'BUY' | 'SELL' | 'HOLD' => {
    if (data.length < 30) return 'HOLD';
    const closes = data.map((c) => c.close);
    const ema9a = calcEMA(closes, 9);
    const ema21a = calcEMA(closes, 21);
    if (!ema9a || !ema21a) return 'HOLD';
    const e9 = ema9a[ema9a.length - 1];
    const e21 = ema21a[ema21a.length - 1];
    const price = closes[closes.length - 1];
    const ich = calcIchimoku(data, price);
    let bias = 0;
    bias += e9 > e21 ? 1 : -1;
    bias += price > e21 ? 1 : -1;
    if (ich?.signal === 'BULLISH') bias += 1;
    else if (ich?.signal === 'BEARISH') bias -= 1;
    if (bias >= 2) return 'BUY';
    if (bias <= -2) return 'SELL';
    return 'HOLD';
  };

  const configs = [
    { label: 'Base', m: 1 },
    { label: 'x3', m: 3 },
    { label: 'x12', m: 12 },
  ];

  const details: { tf: string; signal: 'BUY' | 'SELL' | 'HOLD' }[] = [];
  let bullish = 0, bearish = 0, neutral = 0;

  for (const tf of configs) {
    const agg = aggregate(candles, tf.m);
    const signal = evalSignal(agg);
    details.push({ tf: tf.label, signal });
    if (signal === 'BUY') bullish++;
    else if (signal === 'SELL') bearish++;
    else neutral++;
  }

  const total = details.length || 1;
  const dominant = Math.max(bullish, bearish, neutral);
  const strength = Math.round((dominant / total) * 100);
  const signal = bullish > bearish ? 'BUY' : bearish > bullish ? 'SELL' : 'HOLD';

  return { bullish, bearish, neutral, total, strength, signal, details };
}
