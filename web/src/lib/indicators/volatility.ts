// ============================================
//  Volatility Indicators — Bollinger Bands, ATR, Keltner, BB Squeeze
// ============================================
import type { Candle } from '@/types/market';
import { clamp } from './helpers';
import { calcEMA } from './trend';

export function calcBollingerBands(closes: number[], period = 20, stdDev = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return {
    upper: +(sma + stdDev * sd).toFixed(2),
    middle: +sma.toFixed(2),
    lower: +(sma - stdDev * sd).toFixed(2),
    bandwidth: +((stdDev * sd * 2 / sma) * 100).toFixed(4),
  };
}

export function calcATR(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close),
      ),
    );
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return +atr.toFixed(2);
}

export function calcKeltnerChannels(candles: Candle[], period = 20, multiplier = 1.5) {
  if (!candles || candles.length < period + 1) return null;
  const closes = candles.map((c) => c.close);
  const emaArr = calcEMA(closes, period);
  const atr = calcATR(candles, period);
  if (!emaArr || atr === null) return null;
  const middle = emaArr[emaArr.length - 1];
  const upper = middle + atr * multiplier;
  const lower = middle - atr * multiplier;
  return {
    upper: +upper.toFixed(2),
    middle: +middle.toFixed(2),
    lower: +lower.toFixed(2),
    widthPct: +(((upper - lower) / (middle || 1)) * 100).toFixed(4),
  };
}

export function calcBBSqueeze(
  candles: Candle[],
  bb?: ReturnType<typeof calcBollingerBands> | null,
) {
  const closes = candles.map((c) => c.close);
  const bbVal = bb || calcBollingerBands(closes, 20, 2);
  const kc = calcKeltnerChannels(candles, 20, 1.5);
  if (!bbVal || !kc) return null;
  const bbW = bbVal.middle === 0 ? 0 : ((bbVal.upper - bbVal.lower) / bbVal.middle) * 100;
  const kcW = kc.middle === 0 ? 0 : ((kc.upper - kc.lower) / kc.middle) * 100;
  const isSqueezing = bbVal.upper < kc.upper && bbVal.lower > kc.lower;
  return {
    isSqueezing,
    state: isSqueezing ? 'ON' : 'OFF' as const,
    bbWidth: +bbW.toFixed(4),
    kcWidth: +kcW.toFixed(4),
    intensity: +(kcW === 0 ? 0 : clamp(((kcW - bbW) / kcW) * 100, -100, 100)).toFixed(2),
    keltnerUpper: kc.upper,
    keltnerLower: kc.lower,
  };
}
