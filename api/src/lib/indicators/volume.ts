/**
 * Volume-based indicators — pure functions operating on Candle arrays.
 */
import type { Candle } from '../../prices/prices.api.types';

// ─── OBV ─────────────────────────────────────────────────────────────────────

export interface ObvResult {
    obv: number;
    trend: 'rising' | 'falling' | 'flat'; // slope of last N bars
}

/** On-Balance Volume. `lookback` bars used for trend detection. */
export function obv(candles: Candle[], lookback = 10): ObvResult | null {
    if (candles.length < 2) return null;

    const series: number[] = [0];
    for (let i = 1; i < candles.length; i++) {
        const prev = series[series.length - 1];
        const cur = candles[i];
        const prevClose = candles[i - 1].close;
        if (cur.close > prevClose) series.push(prev + cur.volume);
        else if (cur.close < prevClose) series.push(prev - cur.volume);
        else series.push(prev);
    }

    const last = series[series.length - 1];
    const window = series.slice(-lookback);
    const first = window[0];
    const diff = last - first;
    const trend: ObvResult['trend'] =
        diff > 0 ? 'rising' : diff < 0 ? 'falling' : 'flat';

    return { obv: last, trend };
}

// ─── CVD (Cumulative Volume Delta) ───────────────────────────────────────────

export interface CvdResult {
    cvd: number;
    trend: 'rising' | 'falling' | 'flat';
    divergence: boolean; // price rises while CVD falls (or vice-versa)
}

/**
 * Approximated CVD using (close − open) × volume as a proxy for buy vs sell pressure.
 * A proper CVD requires tick-level data; this approximation is sufficient for 1m+ candles.
 */
export function cvd(candles: Candle[], lookback = 14): CvdResult | null {
    if (candles.length < 2) return null;

    let cumulative = 0;
    const series: number[] = [];
    for (const c of candles) {
        const delta = (c.close - c.open) * c.volume;
        cumulative += delta;
        series.push(cumulative);
    }

    const last = series[series.length - 1];
    const window = series.slice(-lookback);
    const first = window[0];
    const cvdDiff = last - first;

    const priceFirst =
        candles[candles.length - lookback]?.close ?? candles[0].close;
    const priceLast = candles[candles.length - 1].close;
    const priceDiff = priceLast - priceFirst;

    const trend: CvdResult['trend'] =
        cvdDiff > 0 ? 'rising' : cvdDiff < 0 ? 'falling' : 'flat';

    // Divergence: price and CVD move in opposite directions
    const divergence =
        (priceDiff > 0 && cvdDiff < 0) || (priceDiff < 0 && cvdDiff > 0);

    return { cvd: last, trend, divergence };
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────

export interface VwapResult {
    vwap: number;
    deviationBands: {
        upper1: number; // +1 stddev
        lower1: number; // -1 stddev
        upper2: number; // +2 stddev
        lower2: number; // -2 stddev
    };
    priceAbove: boolean;
}

/**
 * Session VWAP — resets at UTC midnight.
 * Accepts any set of candles; automatically filters to the current session (today UTC).
 */
export function vwap(candles: Candle[]): VwapResult | null {
    if (candles.length === 0) return null;

    // Use midnight of the most-recent candle's day as session start
    const lastTs = candles[candles.length - 1].time * 1000;
    const midnightUtc = new Date(lastTs);
    midnightUtc.setUTCHours(0, 0, 0, 0);
    const sessionStart = midnightUtc.getTime();

    const session = candles.filter((c) => c.time * 1000 >= sessionStart);
    if (session.length === 0) return null;

    let cumVol = 0;
    let cumTypicalVol = 0;
    const typicals: number[] = [];

    for (const c of session) {
        const typical = (c.high + c.low + c.close) / 3;
        typicals.push(typical);
        cumVol += c.volume;
        cumTypicalVol += typical * c.volume;
    }

    const vwapVal = cumVol === 0 ? 0 : cumTypicalVol / cumVol;

    // Standard deviation of typical prices (volume-weighted)
    let sumSquaredDev = 0;
    for (let i = 0; i < session.length; i++) {
        sumSquaredDev += session[i].volume * (typicals[i] - vwapVal) ** 2;
    }
    const stdDev = cumVol === 0 ? 0 : Math.sqrt(sumSquaredDev / cumVol);

    const price = session[session.length - 1].close;

    return {
        vwap: vwapVal,
        deviationBands: {
            upper1: vwapVal + stdDev,
            lower1: vwapVal - stdDev,
            upper2: vwapVal + 2 * stdDev,
            lower2: vwapVal - 2 * stdDev,
        },
        priceAbove: price > vwapVal,
    };
}

// ─── Volume Profile ───────────────────────────────────────────────────────────

export interface VolumeProfileResult {
    poc: number; // Price Of Control — price level with highest volume
    valueAreaHigh: number; // VAH — top of 70% value area
    valueAreaLow: number; // VAL — bottom of 70% value area
    skew: 'bullish' | 'bearish' | 'neutral'; // POC relative to value area midpoint
    highVolumeNodes: number[]; // top-3 volume nodes (price levels)
    lowVolumeNodes: number[]; // bottom-3 volume nodes
}

/**
 * Volume Profile — distributes volume into `bins` price buckets and finds the
 * Point of Control (POC), Value Area High/Low, and skew.
 */
export function volumeProfile(
    candles: Candle[],
    bins = 50,
): VolumeProfileResult | null {
    if (candles.length < 5) return null;

    const allHighs = candles.map((c) => c.high);
    const allLows = candles.map((c) => c.low);
    const rangeHigh = Math.max(...allHighs);
    const rangeLow = Math.min(...allLows);
    const range = rangeHigh - rangeLow;

    if (range === 0) return null;

    const binSize = range / bins;
    const buckets = new Array<number>(bins).fill(0);

    for (const c of candles) {
        const candleRange = c.high - c.low;
        if (candleRange === 0) {
            const idx = Math.min(
                Math.floor((c.close - rangeLow) / binSize),
                bins - 1,
            );
            buckets[idx] += c.volume;
            continue;
        }
        // Distribute volume pro-rata across overlapping bins
        for (let b = 0; b < bins; b++) {
            const bLow = rangeLow + b * binSize;
            const bHigh = bLow + binSize;
            const overlap = Math.min(c.high, bHigh) - Math.max(c.low, bLow);
            if (overlap > 0) {
                buckets[b] += c.volume * (overlap / candleRange);
            }
        }
    }

    // POC
    let pocIdx = 0;
    for (let i = 1; i < bins; i++) {
        if (buckets[i] > buckets[pocIdx]) pocIdx = i;
    }
    const poc = rangeLow + pocIdx * binSize + binSize / 2;

    // Value Area (70% of total volume centred around POC)
    const totalVolume = buckets.reduce((a, b) => a + b, 0);
    const vaTarget = totalVolume * 0.7;
    let vaVol = buckets[pocIdx];
    let vaLow = pocIdx;
    let vaHigh = pocIdx;

    while (vaVol < vaTarget) {
        const extendUp = vaHigh < bins - 1 ? buckets[vaHigh + 1] : 0;
        const extendDown = vaLow > 0 ? buckets[vaLow - 1] : 0;
        if (extendUp >= extendDown && vaHigh < bins - 1) {
            vaHigh++;
            vaVol += buckets[vaHigh];
        } else if (vaLow > 0) {
            vaLow--;
            vaVol += buckets[vaLow];
        } else break;
    }

    const valueAreaHigh = rangeLow + vaHigh * binSize + binSize;
    const valueAreaLow = rangeLow + vaLow * binSize;

    // Skew
    const vaMid = (valueAreaHigh + valueAreaLow) / 2;
    const skew: VolumeProfileResult['skew'] =
        poc > vaMid * 1.001
            ? 'bullish'
            : poc < vaMid * 0.999
              ? 'bearish'
              : 'neutral';

    // HVN / LVN — sorted bucket indices
    const ranked = buckets
        .map((v, i) => ({ v, price: rangeLow + i * binSize + binSize / 2 }))
        .sort((a, b) => b.v - a.v);

    const highVolumeNodes = ranked.slice(0, 3).map((r) => r.price);
    const lowVolumeNodes = ranked
        .filter((r) => r.v > 0)
        .slice(-3)
        .map((r) => r.price);

    return {
        poc,
        valueAreaHigh,
        valueAreaLow,
        skew,
        highVolumeNodes,
        lowVolumeNodes,
    };
}
