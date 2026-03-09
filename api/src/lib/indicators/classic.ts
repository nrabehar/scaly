/**
 * Classic technical indicators — pure functions operating on Candle arrays.
 * No external dependencies, no NestJS. Designed for high-frequency server-side use.
 */
import type { Candle } from '../../prices/prices.api.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function closes(candles: Candle[]): number[] {
    return candles.map((c) => c.close);
}

function highs(candles: Candle[]): number[] {
    return candles.map((c) => c.high);
}

function lows(candles: Candle[]): number[] {
    return candles.map((c) => c.low);
}

// ─── SMA ─────────────────────────────────────────────────────────────────────

/** Simple Moving Average. Returns the SMA over the last `period` values, or null if insufficient data. */
export function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

/** Returns the full SMA series (same length as input; first `period − 1` entries are null). */
export function smaFull(values: number[], period: number): (number | null)[] {
    return values.map((_, i) => {
        if (i < period - 1) return null;
        const slice = values.slice(i - period + 1, i + 1);
        return slice.reduce((a, b) => a + b, 0) / period;
    });
}

// ─── EMA ─────────────────────────────────────────────────────────────────────

/** Exponential Moving Average — returns the last EMA value. */
export function ema(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const series = emaFull(values, period);
    return series[series.length - 1] ?? null;
}

/** Returns the full EMA series (same length as input; first `period − 1` entries are null). */
export function emaFull(values: number[], period: number): (number | null)[] {
    const k = 2 / (period + 1);
    const result: (number | null)[] = [];
    let prev: number | null = null;

    for (let i = 0; i < values.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        if (i === period - 1) {
            // Seed with SMA
            const seed =
                values.slice(0, period).reduce((a, b) => a + b, 0) / period;
            prev = seed;
            result.push(seed);
            continue;
        }
        prev = values[i] * k + prev! * (1 - k);
        result.push(prev);
    }
    return result;
}

// ─── RSI (Wilder smoothing) ───────────────────────────────────────────────────

export interface RsiResult {
    rsi: number;
    overbought: boolean; // rsi >= 70
    oversold: boolean; // rsi <= 30
}

/** Wilder RSI. Returns `null` if there are fewer than `period + 1` candles. */
export function rsi(candles: Candle[], period = 14): RsiResult | null {
    const c = closes(candles);
    if (c.length < period + 1) return null;

    const deltas = c.slice(1).map((v, i) => v - c[i]);

    // Initial averages (simple mean of first `period` deltas)
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (deltas[i] > 0) avgGain += deltas[i];
        else avgLoss += -deltas[i];
    }
    avgGain /= period;
    avgLoss /= period;

    // Wilder smoothing for remaining deltas
    for (let i = period; i < deltas.length; i++) {
        const gain = deltas[i] > 0 ? deltas[i] : 0;
        const loss = deltas[i] < 0 ? -deltas[i] : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    const rsiVal = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    return {
        rsi: rsiVal,
        overbought: rsiVal >= 70,
        oversold: rsiVal <= 30,
    };
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

export interface MacdResult {
    macd: number;
    signal: number;
    histogram: number;
    bullish: boolean; // macd > signal
    crossover: boolean; // histogram crossed zero upward vs previous bar
}

export function macd(
    candles: Candle[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9,
): MacdResult | null {
    const c = closes(candles);
    if (c.length < slowPeriod + signalPeriod) return null;

    const fastEma = emaFull(c, fastPeriod);
    const slowEma = emaFull(c, slowPeriod);

    const macdLine: (number | null)[] = fastEma.map((f, i) => {
        const s = slowEma[i];
        return f !== null && s !== null ? f - s : null;
    });

    // Signal EMA applied on the MACD line values only (skip nulls)
    const macdValues = macdLine.filter((v): v is number => v !== null);
    const signalValues = emaFull(macdValues, signalPeriod);
    const signalLast = signalValues[signalValues.length - 1];

    const macdLast = macdValues[macdValues.length - 1];
    const macdPrev = macdValues[macdValues.length - 2] ?? macdLast;
    const signalPrev = signalValues[signalValues.length - 2] ?? signalLast;

    if (
        macdLast === undefined ||
        signalLast === null ||
        signalLast === undefined
    )
        return null;

    const histogram = macdLast - signalLast;
    const histPrev = macdPrev - (signalPrev ?? signalLast);
    const crossover = histogram > 0 && histPrev <= 0;

    return {
        macd: macdLast,
        signal: signalLast,
        histogram,
        bullish: macdLast > signalLast,
        crossover,
    };
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

export interface BollingerResult {
    upper: number;
    middle: number;
    lower: number;
    width: number; // (upper − lower) / middle
    percentB: number; // (price − lower) / (upper − lower)
    squeeze: boolean; // width < 1% (very tight)
}

export function bollingerBands(
    candles: Candle[],
    period = 20,
    stdDevMultiplier = 2,
): BollingerResult | null {
    const c = closes(candles);
    if (c.length < period) return null;

    const slice = c.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    const price = c[c.length - 1];

    const upper = mean + stdDevMultiplier * stdDev;
    const lower = mean - stdDevMultiplier * stdDev;
    const width = (upper - lower) / mean;
    const percentB = upper === lower ? 0.5 : (price - lower) / (upper - lower);

    return {
        upper,
        middle: mean,
        lower,
        width,
        percentB,
        squeeze: width < 0.01,
    };
}

// ─── ATR ─────────────────────────────────────────────────────────────────────

/** Average True Range (Wilder smoothing). Returns `null` if insufficient data. */
export function atr(candles: Candle[], period = 14): number | null {
    if (candles.length < period + 1) return null;

    const trueRanges = candles.slice(1).map((c, i) => {
        const prev = candles[i];
        return Math.max(
            c.high - c.low,
            Math.abs(c.high - prev.close),
            Math.abs(c.low - prev.close),
        );
    });

    // Seed
    let atrVal =
        trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trueRanges.length; i++) {
        atrVal = (atrVal * (period - 1) + trueRanges[i]) / period;
    }
    return atrVal;
}

// ─── Stochastic ───────────────────────────────────────────────────────────────

export interface StochasticResult {
    k: number; // Raw %K
    d: number; // 3-period SMA of %K
    overbought: boolean;
    oversold: boolean;
}

export function stochastic(
    candles: Candle[],
    kPeriod = 14,
    dPeriod = 3,
): StochasticResult | null {
    if (candles.length < kPeriod + dPeriod - 1) return null;

    const kValues: number[] = [];

    for (let i = kPeriod - 1; i < candles.length; i++) {
        const window = candles.slice(i - kPeriod + 1, i + 1);
        const highest = Math.max(...window.map((c) => c.high));
        const lowest = Math.min(...window.map((c) => c.low));
        const range = highest - lowest;
        kValues.push(
            range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100,
        );
    }

    const kLast = kValues[kValues.length - 1];
    const dSlice = kValues.slice(-dPeriod);
    const dLast = dSlice.reduce((a, b) => a + b, 0) / dSlice.length;

    return {
        k: kLast,
        d: dLast,
        overbought: kLast >= 80,
        oversold: kLast <= 20,
    };
}

// ─── Supertrend ───────────────────────────────────────────────────────────────

export interface SupertrendResult {
    direction: 'UP' | 'DOWN';
    signal: 'BUY' | 'SELL';
    value: number; // active trailing band level
    upper: number;
    lower: number;
    distancePct: number; // % distance from price to active band
}

/**
 * Supertrend — ATR trailing-band trend follower.
 * Never returns NEUTRAL: always BUY or SELL, making it the ideal fallback
 * when the SMC engine returns HOLD due to insufficient zone confluence.
 * Faithfully ported from xauusd-analyzer-v2/utils/indicators.ts.
 */
export function supertrend(
    candles: Candle[],
    period = 10,
    multiplier = 3,
): SupertrendResult | null {
    const minLen = Math.max(period + 2, 20);
    if (!candles || candles.length < minLen) return null;

    // Build ATR series (Wilder)
    const trValues: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close),
        );
        trValues.push(tr);
    }
    if (trValues.length < period + 1) return null;

    const atrSeries: (number | null)[] = Array(candles.length).fill(null);
    let atrVal = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrSeries[period] = atrVal;
    for (let i = period + 1; i < candles.length; i++) {
        atrVal = (atrVal * (period - 1) + trValues[i - 1]) / period;
        atrSeries[i] = atrVal;
    }

    const finalUpper: number[] = Array(candles.length).fill(0);
    const finalLower: number[] = Array(candles.length).fill(0);
    const direction: (1 | -1)[] = Array(candles.length).fill(1);

    for (let i = period; i < candles.length; i++) {
        const a = atrSeries[i];
        if (a === null) continue;
        const hl2 = (candles[i].high + candles[i].low) / 2;
        const basicUpper = hl2 + multiplier * a;
        const basicLower = hl2 - multiplier * a;

        if (i === period) {
            finalUpper[i] = basicUpper;
            finalLower[i] = basicLower;
            direction[i] = candles[i].close >= basicLower ? 1 : -1;
            continue;
        }

        const prevU = finalUpper[i - 1];
        const prevL = finalLower[i - 1];
        const prevC = candles[i - 1].close;

        finalUpper[i] =
            basicUpper < prevU || prevC > prevU ? basicUpper : prevU;
        finalLower[i] =
            basicLower > prevL || prevC < prevL ? basicLower : prevL;

        const prevDir = direction[i - 1];
        if (prevDir === -1 && candles[i].close > finalUpper[i]) {
            direction[i] = 1;
        } else if (prevDir === 1 && candles[i].close < finalLower[i]) {
            direction[i] = -1;
        } else {
            direction[i] = prevDir;
        }
    }

    const last = candles.length - 1;
    const dir = direction[last];
    const stValue = dir === 1 ? finalLower[last] : finalUpper[last];
    const price = candles[last].close;
    const distancePct = price === 0 ? 0 : ((price - stValue) / price) * 100;

    return {
        direction: dir === 1 ? 'UP' : 'DOWN',
        signal: dir === 1 ? 'BUY' : 'SELL',
        value: +stValue.toFixed(4),
        upper: +finalUpper[last].toFixed(4),
        lower: +finalLower[last].toFixed(4),
        distancePct: +distancePct.toFixed(3),
    };
}

// ─── Ichimoku (snapshot) ──────────────────────────────────────────────────────

export interface IchimokuResult {
    tenkan: number;
    kijun: number;
    spanA: number;
    spanB: number;
    cloudTop: number;
    cloudBottom: number;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0–100
}

/**
 * Ichimoku Kinko Hyo snapshot — price-vs-cloud signal with strength score.
 * Requires ≥52 candles; returns null with fewer.
 */
export function ichimoku(candles: Candle[]): IchimokuResult | null {
    if (!candles || candles.length < 52) return null;

    const midpoint = (period: number): number => {
        const slice = candles.slice(-period);
        const hi = Math.max(...slice.map((c) => c.high));
        const lo = Math.min(...slice.map((c) => c.low));
        return (hi + lo) / 2;
    };

    const tenkan = midpoint(9);
    const kijun = midpoint(26);
    const spanB = midpoint(52);
    const spanA = (tenkan + kijun) / 2;
    const cloudTop = Math.max(spanA, spanB);
    const cloudBottom = Math.min(spanA, spanB);
    const price = candles[candles.length - 1].close;

    let signal: IchimokuResult['signal'] = 'NEUTRAL';
    let strength = 50;

    if (price > cloudTop && tenkan > kijun) {
        signal = 'BULLISH';
        strength = 75 + (tenkan > spanA ? 10 : 0);
    } else if (price < cloudBottom && tenkan < kijun) {
        signal = 'BEARISH';
        strength = 75 + (tenkan < spanB ? 10 : 0);
    } else if (price > kijun) {
        signal = 'BULLISH';
        strength = 58;
    } else if (price < kijun) {
        signal = 'BEARISH';
        strength = 58;
    }

    return {
        tenkan: +tenkan.toFixed(4),
        kijun: +kijun.toFixed(4),
        spanA: +spanA.toFixed(4),
        spanB: +spanB.toFixed(4),
        cloudTop: +cloudTop.toFixed(4),
        cloudBottom: +cloudBottom.toFixed(4),
        signal,
        strength,
    };
}

// ─── Williams %R ──────────────────────────────────────────────────────────────

/** Williams %R — returns a value in [-100, 0]. Overbought > -20, oversold < -80. */
export function williamsR(candles: Candle[], period = 14): number | null {
    if (candles.length < period) return null;
    const slice = candles.slice(-period);
    const hi = Math.max(...slice.map((c) => c.high));
    const lo = Math.min(...slice.map((c) => c.low));
    const price = candles[candles.length - 1].close;
    if (hi === lo) return -50;
    return +(((hi - price) / (hi - lo)) * -100).toFixed(2);
}

// ─── CCI ─────────────────────────────────────────────────────────────────────

/** Commodity Channel Index. Overbought > +100, oversold < -100. */
export function cci(candles: Candle[], period = 20): number | null {
    if (candles.length < period) return null;
    const typicals = candles.map((c) => (c.high + c.low + c.close) / 3);
    const slice = typicals.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const meanDev = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    if (meanDev === 0) return 0;
    return +(
        (typicals[typicals.length - 1] - mean) /
        (0.015 * meanDev)
    ).toFixed(2);
}

// ─── ADX / DMI ────────────────────────────────────────────────────────────────

export interface AdxResult {
    adx: number;
    plusDI: number; // +DI
    minusDI: number; // -DI
    trending: boolean; // adx >= 25
    strongTrend: boolean; // adx >= 40
    bullish: boolean; // +DI > -DI
}

export function adx(candles: Candle[], period = 14): AdxResult | null {
    if (candles.length < period * 2) return null;

    const candles2 = candles.slice(-(period * 2));

    const plusDMs: number[] = [];
    const minusDMs: number[] = [];
    const trs: number[] = [];

    for (let i = 1; i < candles2.length; i++) {
        const cur = candles2[i];
        const prev = candles2[i - 1];
        const upMove = cur.high - prev.high;
        const downMove = prev.low - cur.low;

        plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
        trs.push(
            Math.max(
                cur.high - cur.low,
                Math.abs(cur.high - prev.close),
                Math.abs(cur.low - prev.close),
            ),
        );
    }

    // Wilder smoothing
    let smoothedTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothedPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothedMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

    const dxValues: number[] = [];
    for (let i = period; i < trs.length; i++) {
        smoothedTR = smoothedTR - smoothedTR / period + trs[i];
        smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[i];
        smoothedMinusDM =
            smoothedMinusDM - smoothedMinusDM / period + minusDMs[i];

        const pDI = smoothedTR === 0 ? 0 : (smoothedPlusDM / smoothedTR) * 100;
        const mDI = smoothedTR === 0 ? 0 : (smoothedMinusDM / smoothedTR) * 100;
        const dx =
            pDI + mDI === 0 ? 0 : (Math.abs(pDI - mDI) / (pDI + mDI)) * 100;
        dxValues.push(dx);
    }

    if (dxValues.length < period) return null;

    const adxVal = dxValues.slice(-period).reduce((a, b) => a + b, 0) / period;
    const smoothedTRFinal = smoothedTR;
    const pDI =
        smoothedTRFinal === 0 ? 0 : (smoothedPlusDM / smoothedTRFinal) * 100;
    const mDI =
        smoothedTRFinal === 0 ? 0 : (smoothedMinusDM / smoothedTRFinal) * 100;

    return {
        adx: adxVal,
        plusDI: pDI,
        minusDI: mDI,
        trending: adxVal >= 25,
        strongTrend: adxVal >= 40,
        bullish: pDI > mDI,
    };
}
