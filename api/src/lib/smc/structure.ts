/**
 * SMC Market Structure — swing detection, BoS/CHoCH, HH/HL/LH/LL sequences.
 */
import type { Candle } from '../../prices/prices.api.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwingType = 'HIGH' | 'LOW';
export type StructureLabel = 'HH' | 'HL' | 'LH' | 'LL';
export type Trend = 'BULLISH' | 'BEARISH' | 'RANGING';

export interface SwingPoint {
    index: number;
    time: number;
    price: number;
    type: SwingType;
}

export interface StructurePoint extends SwingPoint {
    label: StructureLabel;
}

export interface StructureBreak {
    type: 'BoS' | 'CHoCH';
    direction: 'BULLISH' | 'BEARISH';
    breakPrice: number;
    breakTime: number;
    prevStructurePrice: number;
}

export interface MarketStructureResult {
    swings: SwingPoint[];
    structure: StructurePoint[];
    trend: Trend;
    lastBreak: StructureBreak | null;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

// ─── Swing Detection ──────────────────────────────────────────────────────────

/**
 * Detects swing highs and lows using a pivot-point approach.
 * A bar at index `i` is a swing high if `candles[i].high` is the highest
 * in the window `[i-lookback, i+lookback]`, and vice-versa for lows.
 */
export function detectSwings(candles: Candle[], lookback = 5): SwingPoint[] {
    const swings: SwingPoint[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
        const window = candles.slice(i - lookback, i + lookback + 1);
        const maxHigh = Math.max(...window.map((c) => c.high));
        const minLow = Math.min(...window.map((c) => c.low));

        if (candles[i].high === maxHigh) {
            // Make sure it is unique (no duplicate index or price in last swing)
            const last = swings[swings.length - 1];
            if (
                !last ||
                last.type !== 'HIGH' ||
                last.price !== candles[i].high
            ) {
                swings.push({
                    index: i,
                    time: candles[i].time,
                    price: candles[i].high,
                    type: 'HIGH',
                });
            }
        } else if (candles[i].low === minLow) {
            const last = swings[swings.length - 1];
            if (!last || last.type !== 'LOW' || last.price !== candles[i].low) {
                swings.push({
                    index: i,
                    time: candles[i].time,
                    price: candles[i].low,
                    type: 'LOW',
                });
            }
        }
    }

    // Keep alternating — remove consecutive duplicates of the same type keeping the most extreme
    return alternateSwings(swings);
}

function alternateSwings(raw: SwingPoint[]): SwingPoint[] {
    if (raw.length === 0) return [];
    const result: SwingPoint[] = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
        const last = result[result.length - 1];
        if (raw[i].type === last.type) {
            // Keep the more extreme one
            if (
                (raw[i].type === 'HIGH' && raw[i].price > last.price) ||
                (raw[i].type === 'LOW' && raw[i].price < last.price)
            ) {
                result[result.length - 1] = raw[i];
            }
        } else {
            result.push(raw[i]);
        }
    }
    return result;
}

// ─── Market Structure Labels (HH / HL / LH / LL) ─────────────────────────────

export function detectMarketStructure(swings: SwingPoint[]): StructurePoint[] {
    if (swings.length < 2) return [];

    const result: StructurePoint[] = [];
    const highs = swings.filter((s) => s.type === 'HIGH');
    const lows = swings.filter((s) => s.type === 'LOW');

    // Label each high compared to the previous high
    for (let i = 1; i < highs.length; i++) {
        const label: StructureLabel =
            highs[i].price > highs[i - 1].price ? 'HH' : 'LH';
        result.push({ ...highs[i], label });
    }

    // Label each low compared to the previous low
    for (let i = 1; i < lows.length; i++) {
        const label: StructureLabel =
            lows[i].price > lows[i - 1].price ? 'HL' : 'LL';
        result.push({ ...lows[i], label });
    }

    // Sort by candle index
    result.sort((a, b) => a.index - b.index);
    return result;
}

// ─── Trend ────────────────────────────────────────────────────────────────────

export function detectTrend(structure: StructurePoint[]): Trend {
    if (structure.length < 4) return 'RANGING';

    // Use last 6 points (minimum 4) — requires clear 4/6 majority so
    // a brief 1–2 candle pullback cannot flip the trend classification.
    const window = structure.slice(-6);
    const labels = window.map((s) => s.label);

    const bullish = labels.filter((l) => l === 'HH' || l === 'HL').length;
    const bearish = labels.filter((l) => l === 'LH' || l === 'LL').length;
    const total = labels.length;

    if (bullish >= Math.ceil(total * 0.67)) return 'BULLISH';
    if (bearish >= Math.ceil(total * 0.67)) return 'BEARISH';
    return 'RANGING';
}

// ─── Break of Structure (BoS) ─────────────────────────────────────────────────

/**
 * A BoS occurs when price breaks ABOVE the most recent Swing High (in a bullish move)
 * or BELOW the most recent Swing Low (in a bearish move), CONTINUING the existing trend.
 */
export function detectBoS(
    swings: SwingPoint[],
    currentPrice: number,
): StructureBreak | null {
    if (swings.length < 2) return null;

    const lastHigh = [...swings].filter((s) => s.type === 'HIGH').at(-1);
    const lastLow = [...swings].filter((s) => s.type === 'LOW').at(-1);

    if (lastHigh && currentPrice > lastHigh.price) {
        return {
            type: 'BoS',
            direction: 'BULLISH',
            breakPrice: lastHigh.price,
            breakTime: lastHigh.time,
            prevStructurePrice: lastHigh.price,
        };
    }

    if (lastLow && currentPrice < lastLow.price) {
        return {
            type: 'BoS',
            direction: 'BEARISH',
            breakPrice: lastLow.price,
            breakTime: lastLow.time,
            prevStructurePrice: lastLow.price,
        };
    }

    return null;
}

// ─── Change of Character (CHoCH) ──────────────────────────────────────────────

/**
 * A CHoCH occurs when price breaks the most recent swing in the OPPOSITE direction,
 * signalling a potential trend reversal.
 */
export function detectCHoCH(
    swings: SwingPoint[],
    structure: StructurePoint[],
    currentPrice: number,
): StructureBreak | null {
    if (structure.length < 2) return null;

    const trend = detectTrend(structure);

    if (trend === 'BULLISH') {
        // CHoCH: price breaks below the most recent Higher Low
        const lastHL = [...structure].filter((s) => s.label === 'HL').at(-1);
        if (lastHL && currentPrice < lastHL.price) {
            return {
                type: 'CHoCH',
                direction: 'BEARISH',
                breakPrice: lastHL.price,
                breakTime: lastHL.time,
                prevStructurePrice: lastHL.price,
            };
        }
    }

    if (trend === 'BEARISH') {
        // CHoCH: price breaks above the most recent Lower High
        const lastLH = [...structure].filter((s) => s.label === 'LH').at(-1);
        if (lastLH && currentPrice > lastLH.price) {
            return {
                type: 'CHoCH',
                direction: 'BULLISH',
                breakPrice: lastLH.price,
                breakTime: lastLH.time,
                prevStructurePrice: lastLH.price,
            };
        }
    }

    return null;
}

// ─── Full Analysis ────────────────────────────────────────────────────────────

export function analyzeMarketStructure(
    candles: Candle[],
    lookback = 5,
): MarketStructureResult {
    const swings = detectSwings(candles, lookback);
    const structure = detectMarketStructure(swings);
    const trend = detectTrend(structure);
    const currentPrice = candles[candles.length - 1]?.close ?? 0;

    const choch = detectCHoCH(swings, structure, currentPrice);
    const bos = choch ? null : detectBoS(swings, currentPrice);
    const lastBreak = choch ?? bos;

    const bias: MarketStructureResult['bias'] =
        trend === 'BULLISH'
            ? 'BULLISH'
            : trend === 'BEARISH'
              ? 'BEARISH'
              : 'NEUTRAL';

    return { swings, structure, trend, lastBreak, bias };
}
