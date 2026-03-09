/**
 * SMC Liquidity levels — Buy-Side Liquidity (BSL) and Sell-Side Liquidity (SSL).
 * BSL = equal highs (resting stop-losses of short sellers above recent highs).
 * SSL = equal lows  (resting stop-losses of long traders below recent lows).
 */
import type { Candle } from '../../prices/prices.api.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityLevel {
    type: 'BSL' | 'SSL';
    price: number;
    /** Number of equal highs/lows that form this cluster */
    strength: number;
    /** The candle timestamps that contribute to this level */
    times: number[];
    /** Has price swept this level already? */
    swept: boolean;
}

export interface LiquidityResult {
    bsl: LiquidityLevel[]; // Buy-Side Liquidity levels (resistance liquidity)
    ssl: LiquidityLevel[]; // Sell-Side Liquidity levels (support liquidity)
    nearestBsl: LiquidityLevel | null;
    nearestSsl: LiquidityLevel | null;
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Detects liquidity clusters from equal highs (BSL) and equal lows (SSL).
 *
 * @param candles   Input candles (OHLCV)
 * @param tolerance Relative tolerance for "equal" price comparison (default 0.001 = 0.1%)
 * @param maxLevels Maximum BSL and SSL levels to return per side (default 5)
 */
export function detectLiquidityLevels(
    candles: Candle[],
    tolerance = 0.001,
    maxLevels = 5,
): LiquidityResult {
    if (candles.length < 10) {
        return { bsl: [], ssl: [], nearestBsl: null, nearestSsl: null };
    }

    const currentPrice = candles[candles.length - 1].close;

    // ── Equal Highs → BSL
    const bslLevels = clusterPrices(
        candles.map((c) => ({ price: c.high, time: c.time })),
        tolerance,
        'BSL',
        candles,
    );

    // ── Equal Lows → SSL
    const sslLevels = clusterPrices(
        candles.map((c) => ({ price: c.low, time: c.time })),
        tolerance,
        'SSL',
        candles,
    );

    // Sort by strength (number of touches) descending
    bslLevels.sort((a, b) => b.strength - a.strength);
    sslLevels.sort((a, b) => b.strength - a.strength);

    const topBsl = bslLevels.filter((l) => !l.swept).slice(0, maxLevels);
    const topSsl = sslLevels.filter((l) => !l.swept).slice(0, maxLevels);

    const nearestBsl = topBsl.reduce<LiquidityLevel | null>((best, lvl) => {
        if (!best) return lvl;
        return Math.abs(lvl.price - currentPrice) <
            Math.abs(best.price - currentPrice)
            ? lvl
            : best;
    }, null);

    const nearestSsl = topSsl.reduce<LiquidityLevel | null>((best, lvl) => {
        if (!best) return lvl;
        return Math.abs(lvl.price - currentPrice) <
            Math.abs(best.price - currentPrice)
            ? lvl
            : best;
    }, null);

    return { bsl: topBsl, ssl: topSsl, nearestBsl, nearestSsl };
}

// ─── Clustering helper ────────────────────────────────────────────────────────

function clusterPrices(
    points: { price: number; time: number }[],
    tolerance: number,
    type: 'BSL' | 'SSL',
    candles: Candle[],
): LiquidityLevel[] {
    const clusters: LiquidityLevel[] = [];

    for (const pt of points) {
        const existing = clusters.find(
            (c) =>
                Math.abs(c.price - pt.price) / ((c.price + pt.price) / 2) <=
                tolerance,
        );
        if (existing) {
            existing.strength++;
            existing.times.push(pt.time);
            // Update price to weighted average
            existing.price =
                (existing.price * (existing.strength - 1) + pt.price) /
                existing.strength;
        } else {
            clusters.push({
                type,
                price: pt.price,
                strength: 1,
                times: [pt.time],
                swept: false,
            });
        }
    }

    // Only keep levels with ≥2 touches (single highs/lows are not liquidity pools)
    const meaningful = clusters.filter((c) => c.strength >= 2);

    // Mark swept levels (price has already moved through them)
    const currentPrice = candles[candles.length - 1].close;
    for (const c of meaningful) {
        if (type === 'BSL') {
            // BSL is swept if a recent candle closed above it
            const lastCandles = candles.slice(-5);
            c.swept = lastCandles.some(
                (k) => k.high > c.price * (1 + tolerance),
            );
        } else {
            // SSL is swept if a recent candle closed below it
            const lastCandles = candles.slice(-5);
            c.swept = lastCandles.some(
                (k) => k.low < c.price * (1 - tolerance),
            );
        }
    }

    return meaningful;
}
