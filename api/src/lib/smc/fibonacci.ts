/**
 * SMC Fibonacci retracements and Golden Pocket detection.
 */
import type { Candle } from '../../prices/prices.api.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwingBounds {
    high: number;
    low: number;
    trend: 'BULLISH' | 'BEARISH'; // direction of the swing being retraced
    highTime: number;
    lowTime: number;
}

export interface FibLevels {
    swing: SwingBounds;
    levels: { ratio: number; price: number; label: string }[];
    goldenPocket: { top: number; bottom: number };
    extension1: number; // 1.272 extension
    extension2: number; // 1.618 extension
}

// Standard Fibonacci ratios
const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.65, 0.786, 1];

// ─── Swing Detection for Fibonacci ───────────────────────────────────────────

/**
 * Finds the most significant swing high and low within the last `lookback` candles.
 * Returns both high and low and infers trend direction from their time order.
 */
export function detectLastSwing(
    candles: Candle[],
    lookback = 50,
): SwingBounds | null {
    if (candles.length < lookback) return null;

    const window = candles.slice(-lookback);
    let highIdx = 0;
    let lowIdx = 0;

    for (let i = 1; i < window.length; i++) {
        if (window[i].high > window[highIdx].high) highIdx = i;
        if (window[i].low < window[lowIdx].low) lowIdx = i;
    }

    const high = window[highIdx].high;
    const low = window[lowIdx].low;
    const highTime = window[highIdx].time;
    const lowTime = window[lowIdx].time;

    // If the high came AFTER the low → likely bearish swing (price moved from low → high → now retracing down)
    // If the low came AFTER the high → likely bullish swing (price moved from high → low → now retracing up)
    const trend: SwingBounds['trend'] =
        highTime > lowTime ? 'BEARISH' : 'BULLISH';

    return { high, low, highTime, lowTime, trend };
}

// ─── Fibonacci Level Calculation ─────────────────────────────────────────────

/**
 * Computes Fibonacci retracement levels from a swing.
 *
 * For a BULLISH swing (price bounced from low, retracing up):
 *   - 0 = low, 1 = high
 *   - Levels fill from high downward
 *
 * For a BEARISH swing (price topped at high, retracing down):
 *   - 0 = high, 1 = low
 *   - Levels fill from low upward
 */
export function calcFibLevels(swing: SwingBounds): FibLevels {
    const range = swing.high - swing.low;

    const levels = FIB_RATIOS.map((ratio) => {
        let price: number;
        if (swing.trend === 'BULLISH') {
            // Retrace downward from high
            price = swing.high - ratio * range;
        } else {
            // Retrace upward from low
            price = swing.low + ratio * range;
        }
        return { ratio, price, label: `${(ratio * 100).toFixed(1)}%` };
    });

    // Golden Pocket: 0.618 – 0.65
    const gp618 = levels.find((l) => l.ratio === 0.618)!;
    const gp650 = levels.find((l) => l.ratio === 0.65)!;

    const [gpTop, gpBottom] =
        gp618.price > gp650.price
            ? [gp618.price, gp650.price]
            : [gp650.price, gp618.price];

    // Extensions
    const ext1 =
        swing.trend === 'BULLISH'
            ? swing.high + 0.272 * range
            : swing.low - 0.272 * range;
    const ext2 =
        swing.trend === 'BULLISH'
            ? swing.high + 0.618 * range
            : swing.low - 0.618 * range;

    return {
        swing,
        levels,
        goldenPocket: { top: gpTop, bottom: gpBottom },
        extension1: ext1,
        extension2: ext2,
    };
}

// ─── Price vs Fibonacci Zone ──────────────────────────────────────────────────

export function isInGoldenPocket(price: number, fib: FibLevels): boolean {
    const { bottom, top } = fib.goldenPocket;
    return price >= bottom && price <= top;
}

/**
 * Returns 'PREMIUM' if price is in the upper half of the range,
 * 'DISCOUNT' if in the lower half, 'EQUILIBRIUM' if near the 50% level.
 */
export function getPriceZone(
    price: number,
    fib: FibLevels,
): 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' {
    const midpoint = (fib.swing.high + fib.swing.low) / 2;
    const band = (fib.swing.high - fib.swing.low) * 0.05; // 5% tolerance
    if (price > midpoint + band) return 'PREMIUM';
    if (price < midpoint - band) return 'DISCOUNT';
    return 'EQUILIBRIUM';
}

// ─── Convenience wrapper ─────────────────────────────────────────────────────

/** Full Fibonacci analysis: detect swing + compute levels in one call. */
export function analyzeFibonacci(
    candles: Candle[],
    lookback = 50,
): FibLevels | null {
    const swing = detectLastSwing(candles, lookback);
    if (!swing) return null;
    return calcFibLevels(swing);
}
