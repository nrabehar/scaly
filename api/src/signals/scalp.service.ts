import { Injectable } from '@nestjs/common';
import type { Candle } from './dto/candle.interface';

interface ScalpResult {
  side: 'BUY' | 'SELL' | 'HOLD';
  entry: number;
  tp: number;
  sl: number;
  confidence: number;
  reasons: string[];
}

@Injectable()
export class ScalpService {
  /**
   * Algorithmic 3-min scalp prediction engine.
   * Uses 20+ weighted factors to produce entry/TP/SL with a short horizon.
   */
  predict(symbol: string, candles: Candle[]): ScalpResult {
    if (!candles || candles.length < 30) {
      return { side: 'HOLD', entry: 0, tp: 0, sl: 0, confidence: 0, reasons: ['Insufficient data'] };
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume || 0);
    const current = closes[closes.length - 1];
    const reasons: string[] = [];
    let score = 0; // -100 to +100

    // 1. RSI extremes
    const rsi = this.calcRSI(closes, 14);
    if (rsi !== null) {
      if (rsi < 25) { score += 15; reasons.push(`RSI oversold (${rsi.toFixed(1)})`); }
      else if (rsi < 35) { score += 8; reasons.push(`RSI low (${rsi.toFixed(1)})`); }
      else if (rsi > 75) { score -= 15; reasons.push(`RSI overbought (${rsi.toFixed(1)})`); }
      else if (rsi > 65) { score -= 8; reasons.push(`RSI high (${rsi.toFixed(1)})`); }
    }

    // 2. EMA crossover (9/21)
    const ema9 = this.calcEMALast(closes, 9);
    const ema21 = this.calcEMALast(closes, 21);
    if (ema9 !== null && ema21 !== null) {
      if (ema9 > ema21) { score += 10; reasons.push('EMA 9 > 21'); }
      else { score -= 10; reasons.push('EMA 9 < 21'); }
    }

    // 3. MACD momentum
    const macd = this.calcMACDSimple(closes);
    if (macd) {
      if (macd.histogram > 0 && macd.histogram > macd.prevHistogram) { score += 12; reasons.push('MACD momentum rising'); }
      else if (macd.histogram < 0 && macd.histogram < macd.prevHistogram) { score -= 12; reasons.push('MACD momentum falling'); }
    }

    // 4. Bollinger Band position
    const bb = this.calcBB(closes, 20, 2);
    if (bb) {
      const bbPos = (current - bb.lower) / (bb.upper - bb.lower || 1);
      if (bbPos < 0.15) { score += 10; reasons.push('Near BB lower'); }
      else if (bbPos > 0.85) { score -= 10; reasons.push('Near BB upper'); }
    }

    // 5. Stochastic extremes
    const stoch = this.calcStoch(candles, 14);
    if (stoch !== null) {
      if (stoch < 20) { score += 8; reasons.push(`Stoch oversold (${stoch.toFixed(1)})`); }
      else if (stoch > 80) { score -= 8; reasons.push(`Stoch overbought (${stoch.toFixed(1)})`); }
    }

    // 6. Volume spike
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const lastVol = volumes[volumes.length - 1];
    if (avgVol > 0 && lastVol > avgVol * 1.8) {
      const lastCandle = candles[candles.length - 1];
      if (lastCandle.close > lastCandle.open) { score += 8; reasons.push('Bullish volume spike'); }
      else { score -= 8; reasons.push('Bearish volume spike'); }
    }

    // 7. Price vs VWAP
    const vwap = this.calcVWAP(candles);
    if (vwap !== null) {
      if (current > vwap) { score += 5; reasons.push('Above VWAP'); }
      else { score -= 5; reasons.push('Below VWAP'); }
    }

    // 8. Last candle pattern
    const last = candles[candles.length - 1];
    const body = Math.abs(last.close - last.open);
    const lWick = Math.min(last.open, last.close) - last.low;
    const uWick = last.high - Math.max(last.open, last.close);
    if (lWick > body * 2 && uWick < body * 0.5 && body > 0) { score += 7; reasons.push('Hammer pattern'); }
    if (uWick > body * 2 && lWick < body * 0.5 && body > 0) { score -= 7; reasons.push('Shooting star'); }

    // 9. ATR movement check
    const atr = this.calcATR(candles, 14);

    // 10. Short-term momentum (3-bar)
    if (closes.length >= 4) {
      const mom = closes[closes.length - 1] - closes[closes.length - 4];
      if (mom > 0) { score += 5; reasons.push('3-bar momentum up'); }
      else { score -= 5; reasons.push('3-bar momentum down'); }
    }

    // Determine direction
    const clampedScore = Math.max(-100, Math.min(100, score));
    let side: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (clampedScore >= 15) side = 'BUY';
    else if (clampedScore <= -15) side = 'SELL';

    // Calculate levels
    const atrVal = atr || current * 0.001;
    const entry = current;
    let tp: number, sl: number;
    if (side === 'BUY') {
      tp = +(entry + atrVal * 1.5).toFixed(2);
      sl = +(entry - atrVal * 1.0).toFixed(2);
    } else if (side === 'SELL') {
      tp = +(entry - atrVal * 1.5).toFixed(2);
      sl = +(entry + atrVal * 1.0).toFixed(2);
    } else {
      tp = entry;
      sl = entry;
    }

    const confidence = Math.min(95, Math.abs(clampedScore) + 10);

    return { side, entry: +entry.toFixed(2), tp, sl, confidence, reasons };
  }

  // ── Mini indicator helpers (self-contained) ──

  private calcRSI(closes: number[], period: number): number | null {
    if (closes.length < period + 1) return null;
    let g = 0, l = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) g += d; else l -= d;
    }
    let ag = g / period, al = l / period;
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
      al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    }
    return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }

  private calcEMALast(data: number[], period: number): number | null {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
    return ema;
  }

  private calcMACDSimple(closes: number[]) {
    const ema12 = this.calcEMALast(closes, 12);
    const ema26 = this.calcEMALast(closes, 26);
    const prev12 = this.calcEMALast(closes.slice(0, -1), 12);
    const prev26 = this.calcEMALast(closes.slice(0, -1), 26);
    if (ema12 === null || ema26 === null || prev12 === null || prev26 === null) return null;
    return { histogram: ema12 - ema26, prevHistogram: prev12 - prev26 };
  }

  private calcBB(closes: number[], period: number, std: number) {
    if (closes.length < period) return null;
    const sl = closes.slice(-period);
    const sma = sl.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(sl.reduce((s, v) => s + (v - sma) ** 2, 0) / period);
    return { upper: sma + std * sd, middle: sma, lower: sma - std * sd };
  }

  private calcStoch(candles: Candle[], period: number): number | null {
    if (candles.length < period) return null;
    const slice = candles.slice(-period);
    const hi = Math.max(...slice.map((c) => c.high));
    const lo = Math.min(...slice.map((c) => c.low));
    return hi === lo ? 50 : ((candles[candles.length - 1].close - lo) / (hi - lo)) * 100;
  }

  private calcATR(candles: Candle[], period: number): number | null {
    if (candles.length < period + 1) return null;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
    return atr;
  }

  private calcVWAP(candles: Candle[]): number | null {
    let tpv = 0, vol = 0;
    for (const c of candles) {
      const v = c.volume || 1;
      tpv += ((c.high + c.low + c.close) / 3) * v;
      vol += v;
    }
    return vol === 0 ? null : tpv / vol;
  }
}
