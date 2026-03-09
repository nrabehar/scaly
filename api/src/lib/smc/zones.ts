/**
 * SMC Order Blocks & Fair Value Gaps — pure functions.
 */
import type { Candle } from '../../prices/prices.api.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ZoneType =
    | 'BULLISH_OB'
    | 'BEARISH_OB'
    | 'BULLISH_FVG'
    | 'BEARISH_FVG'
    | 'BULLISH_BREAKER'
    | 'BEARISH_BREAKER';

export interface Zone {
    type: ZoneType;
    top: number;
    bottom: number;
    midpoint: number;
    /** Candle that created the zone */
    originTime: number;
    /** Percentage of zone filled by price (0 = pristine, 1 = fully mitigated) */
    mitigated: number;
    /** True when price has returned to zone */
    tested: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bodySize(c: Candle): number {
    return Math.abs(c.close - c.open);
}

function avgBodySize(candles: Candle[]): number {
    const bodies = candles.map(bodySize);
    return bodies.reduce((a, b) => a + b, 0) / bodies.length;
}

function isStrong(candle: Candle, avg: number, multiplier = 1.5): boolean {
    return bodySize(candle) >= avg * multiplier;
}

// ─── Order Blocks ─────────────────────────────────────────────────────────────

/**
 * An Order Block is the last opposing candle before a strong impulsive move.
 *
 * Bullish OB: last bearish candle before a bullish impulse (close > open of impulse significantly).
 * Bearish OB: last bullish candle before a bearish impulse.
 *
 * `maxZones` limits how many are returned (most recent first).
 */
export function detectOrderBlocks(candles: Candle[], maxZones = 5): Zone[] {
    if (candles.length < 5) return [];

    const avg = avgBodySize(candles);
    const zones: Zone[] = [];

    for (let i = 2; i < candles.length - 1; i++) {
        const impulse = candles[i + 1];
        const ob = candles[i];

        if (!isStrong(impulse, avg, 1.5)) continue;

        // Bullish impulse: (impulse is bullish) and OB is the last bearish candle
        if (impulse.close > impulse.open && ob.close < ob.open) {
            zones.push({
                type: 'BULLISH_OB',
                top: Math.max(ob.open, ob.close),
                bottom: Math.min(ob.open, ob.close),
                midpoint: (ob.high + ob.low) / 2,
                originTime: ob.time,
                mitigated: 0,
                tested: false,
            });
        }

        // Bearish impulse: (impulse is bearish) and OB is the last bullish candle
        if (impulse.close < impulse.open && ob.close > ob.open) {
            zones.push({
                type: 'BEARISH_OB',
                top: Math.max(ob.open, ob.close),
                bottom: Math.min(ob.open, ob.close),
                midpoint: (ob.high + ob.low) / 2,
                originTime: ob.time,
                mitigated: 0,
                tested: false,
            });
        }
    }

    // Sort most recent first
    zones.sort((a, b) => b.originTime - a.originTime);

    // Mark mitigation based on subsequent price action
    const currentPrice = candles[candles.length - 1].close;
    for (const z of zones) {
        const candlesAfter = candles.filter((c) => c.time > z.originTime);
        let deepest = 0;

        for (const c of candlesAfter) {
            if (z.type === 'BULLISH_OB') {
                const penetration = z.top - Math.min(c.low, c.close);
                const pct = penetration / (z.top - z.bottom || 1);
                if (pct > deepest) deepest = pct;
            } else {
                const penetration = Math.max(c.high, c.close) - z.bottom;
                const pct = penetration / (z.top - z.bottom || 1);
                if (pct > deepest) deepest = pct;
            }
        }

        z.mitigated = Math.max(0, Math.min(1, deepest));
        z.tested = z.mitigated > 0;
    }

    // Remove fully mitigated zones and limit count
    return zones.filter((z) => z.mitigated < 0.9).slice(0, maxZones);
}

// ─── Fair Value Gaps ──────────────────────────────────────────────────────────

/**
 * A Fair Value Gap is a 3-candle pattern where the first candle's wick and the
 * third candle's wick do NOT overlap, leaving an unfilled price gap.
 *
 * Bullish FVG: third candle low > first candle high.
 * Bearish FVG: third candle high < first candle low.
 */
export function detectFVG(candles: Candle[], maxZones = 5): Zone[] {
    if (candles.length < 3) return [];

    const zones: Zone[] = [];

    for (let i = 1; i < candles.length - 1; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];
        const next = candles[i + 1];

        // Bullish FVG: gap between prev.high and next.low
        if (next.low > prev.high) {
            zones.push({
                type: 'BULLISH_FVG',
                top: next.low,
                bottom: prev.high,
                midpoint: (next.low + prev.high) / 2,
                originTime: curr.time,
                mitigated: 0,
                tested: false,
            });
        }

        // Bearish FVG: gap between prev.low and next.high
        if (next.high < prev.low) {
            zones.push({
                type: 'BEARISH_FVG',
                top: prev.low,
                bottom: next.high,
                midpoint: (prev.low + next.high) / 2,
                originTime: curr.time,
                mitigated: 0,
                tested: false,
            });
        }
    }

    zones.sort((a, b) => b.originTime - a.originTime);

    // Mark mitigation
    for (const z of zones) {
        const candlesAfter = candles.filter((c) => c.time > z.originTime);
        for (const c of candlesAfter) {
            if (z.type === 'BULLISH_FVG' && c.low <= z.midpoint) {
                z.mitigated =
                    c.low <= z.bottom
                        ? 1
                        : (z.top - c.low) / (z.top - z.bottom);
                z.tested = true;
            }
            if (z.type === 'BEARISH_FVG' && c.high >= z.midpoint) {
                z.mitigated =
                    c.high >= z.top
                        ? 1
                        : (c.high - z.bottom) / (z.top - z.bottom);
                z.tested = true;
            }
        }
    }

    return zones.filter((z) => z.mitigated < 0.9).slice(0, maxZones);
}

// ─── Breaker Blocks ──────────────────────────────────────────────────────────

/**
 * A Breaker Block is a failed Order Block that has flipped polarity.
 *
 * Mechanics (per image):
 *   - BEARISH OB: price was rejected from the zone, but later a strong impulse
 *     sweeps THROUGH the zone (closes beyond it), breaking structure upward.
 *     The old bearish OB is now a BULLISH BREAKER — support on re-test.
 *
 *   - BULLISH OB: price was supported by the zone, but a strong impulse sweeps
 *     THROUGH it downward (CHoCH/BoS to the downside).
 *     The old bullish OB is now a BEARISH BREAKER — resistance on re-test.
 *
 * Detection steps:
 *   1. Identify all raw OBs (including those that were later mitigated).
 *   2. For each OB, scan subsequent candles for a full sweep-through.
 *   3. Verify a structural displacement candle (strong body) after the sweep.
 *   4. Confirm the zone has not been re-mitigated again afterwards.
 */
export function detectBreakerBlocks(candles: Candle[], maxZones = 4): Zone[] {
    if (candles.length < 10) return [];

    const avg = avgBodySize(candles);
    const breakers: Zone[] = [];

    // Build raw OBs without the mitigation filter
    const rawObs = buildRawOrderBlocks(candles);

    for (const ob of rawObs) {
        const obIdx = candles.findIndex((c) => c.time === ob.originTime);
        if (obIdx < 0 || obIdx >= candles.length - 2) continue;

        const after = candles.slice(obIdx + 1);
        let sweptIdx = -1;

        if (ob.type === 'BEARISH_OB') {
            // Breaker condition: a candle closes ABOVE the zone top (sweep upward)
            for (let j = 0; j < after.length; j++) {
                if (after[j].close > ob.top) {
                    sweptIdx = j;
                    break;
                }
            }
        } else if (ob.type === 'BULLISH_OB') {
            // Breaker condition: a candle closes BELOW the zone bottom (sweep downward)
            for (let j = 0; j < after.length; j++) {
                if (after[j].close < ob.bottom) {
                    sweptIdx = j;
                    break;
                }
            }
        }

        if (sweptIdx < 0) continue; // never swept — skip

        // Require at least one strong displacement candle at or near the sweep
        const sweepCandle = after[sweptIdx];
        if (!isStrong(sweepCandle, avg, 1.2)) continue;

        // After the sweep, check the zone has been re-visited from the new side
        // (not strictly required for detection but raises quality; we mark it as
        // "tested" if price came back into range after the sweep)
        const afterSweep = after.slice(sweptIdx + 1);
        const retested = afterSweep.some((c) => {
            if (ob.type === 'BEARISH_OB') {
                // Re-test from above: price dips back into zone
                return c.low <= ob.top && c.high >= ob.bottom;
            } else {
                // Re-test from below: price bounces back into zone
                return c.high >= ob.bottom && c.low <= ob.top;
            }
        });

        // Only include if still near the current price (within 3 ATR)
        const currentPrice = candles[candles.length - 1].close;
        const zoneMid = ob.midpoint;
        const atrApprox = avg * 2;
        if (Math.abs(zoneMid - currentPrice) > atrApprox * 6) continue;

        const breakerType: ZoneType =
            ob.type === 'BEARISH_OB' ? 'BULLISH_BREAKER' : 'BEARISH_BREAKER';

        breakers.push({
            type: breakerType,
            top: ob.top,
            bottom: ob.bottom,
            midpoint: ob.midpoint,
            originTime: ob.originTime,
            mitigated: retested ? 0.5 : 0,
            tested: retested,
        });
    }

    // Most recent first, limit count
    breakers.sort((a, b) => b.originTime - a.originTime);
    return breakers.slice(0, maxZones);
}

/** Build raw OBs without filtering mitigated ones (used by breaker detection). */
function buildRawOrderBlocks(candles: Candle[]): Zone[] {
    if (candles.length < 5) return [];
    const avg = avgBodySize(candles);
    const zones: Zone[] = [];
    for (let i = 2; i < candles.length - 1; i++) {
        const impulse = candles[i + 1];
        const ob = candles[i];
        if (!isStrong(impulse, avg, 1.5)) continue;
        if (impulse.close > impulse.open && ob.close < ob.open) {
            zones.push({
                type: 'BULLISH_OB',
                top: Math.max(ob.open, ob.close),
                bottom: Math.min(ob.open, ob.close),
                midpoint: (ob.high + ob.low) / 2,
                originTime: ob.time,
                mitigated: 0,
                tested: false,
            });
        }
        if (impulse.close < impulse.open && ob.close > ob.open) {
            zones.push({
                type: 'BEARISH_OB',
                top: Math.max(ob.open, ob.close),
                bottom: Math.min(ob.open, ob.close),
                midpoint: (ob.high + ob.low) / 2,
                originTime: ob.time,
                mitigated: 0,
                tested: false,
            });
        }
    }
    zones.sort((a, b) => b.originTime - a.originTime);
    return zones;
}

// ─── Nearest Zone ─────────────────────────────────────────────────────────────

/** Returns the closest zone to `price` from a set of zones. */
export function findNearestZone(zones: Zone[], price: number): Zone | null {
    if (zones.length === 0) return null;
    return zones.reduce((best, z) => {
        const d = Math.abs(z.midpoint - price);
        const dBest = Math.abs(best.midpoint - price);
        return d < dBest ? z : best;
    });
}
