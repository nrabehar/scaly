/**
 * Ichimoku Kinko Hyo — pure functions operating on Candle arrays.
 */
import type { Candle } from '../../prices/prices.api.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function midpoint(candles: Candle[]): number {
    const h = Math.max(...candles.map((c) => c.high));
    const l = Math.min(...candles.map((c) => c.low));
    return (h + l) / 2;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface IchimokuResult {
    tenkan: number; // Conversion line (9 periods)
    kijun: number; // Base line (26 periods)
    senkouA: number; // Leading span A (avg of tenkan + kijun, plotted 26 ahead)
    senkouB: number; // Leading span B (52-period midpoint, plotted 26 ahead)
    chikou: number; // Lagging span (current close shifted 26 back — here: 26th bar ago close)
    cloudTop: number; // max(senkouA, senkouB)
    cloudBottom: number; // min(senkouA, senkouB)
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    /**
     * Price vs cloud position.
     * 'ABOVE' — price above both cloud spans → bullish zone.
     * 'BELOW' — price below both cloud spans → bearish zone.
     * 'INSIDE' — price inside the cloud → contested.
     */
    priceVsCloud: 'ABOVE' | 'BELOW' | 'INSIDE';
    tkCross: 'BULLISH' | 'BEARISH' | 'NONE'; // Tenkan/Kijun cross on last bar
    cloudColor: 'green' | 'red'; // senkouA > senkouB → green
}

/**
 * Standard Ichimoku (9 / 26 / 52).
 * Requires at least 52 candles. Returns `null` otherwise.
 */
export function ichimoku(candles: Candle[]): IchimokuResult | null {
    if (candles.length < 52) return null;

    const last = candles[candles.length - 1];

    // Tenkan-sen — 9-period midpoint
    const tenkan = midpoint(candles.slice(-9));

    // Kijun-sen — 26-period midpoint
    const kijun = midpoint(candles.slice(-26));

    // Senkou A = (tenkan + kijun) / 2
    const senkouA = (tenkan + kijun) / 2;

    // Senkou B = 52-period midpoint
    const senkouB = midpoint(candles.slice(-52));

    // Chikou — close of 26 bars ago
    const chikouCandle = candles[candles.length - 26];
    const chikou = chikouCandle?.close ?? last.close;

    const cloudTop = Math.max(senkouA, senkouB);
    const cloudBottom = Math.min(senkouA, senkouB);
    const price = last.close;

    const priceVsCloud: IchimokuResult['priceVsCloud'] =
        price > cloudTop ? 'ABOVE' : price < cloudBottom ? 'BELOW' : 'INSIDE';

    // TK cross on last two bars
    let tkCross: IchimokuResult['tkCross'] = 'NONE';
    if (candles.length >= 53) {
        const prev = candles.slice(0, -1);
        const prevTenkan = midpoint(prev.slice(-9));
        const prevKijun = midpoint(prev.slice(-26));
        if (prevTenkan <= prevKijun && tenkan > kijun) tkCross = 'BULLISH';
        else if (prevTenkan >= prevKijun && tenkan < kijun) tkCross = 'BEARISH';
    }

    // Overall signal
    const bullish =
        priceVsCloud === 'ABOVE' &&
        senkouA > senkouB &&
        chikou > candles[candles.length - 26 - 1]?.close;
    const bearish =
        priceVsCloud === 'BELOW' &&
        senkouB > senkouA &&
        chikou < candles[candles.length - 26 - 1]?.close;

    const signal: IchimokuResult['signal'] = bullish
        ? 'BULLISH'
        : bearish
          ? 'BEARISH'
          : 'NEUTRAL';

    return {
        tenkan,
        kijun,
        senkouA,
        senkouB,
        chikou,
        cloudTop,
        cloudBottom,
        signal,
        priceVsCloud,
        tkCross,
        cloudColor: senkouA >= senkouB ? 'green' : 'red',
    };
}
