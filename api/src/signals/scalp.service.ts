/**
 * ScalpService — ICT/SMC-only signal generator.
 *
 * Pure price action engine: market structure → zone confluence → liquidity →
 * displacement → signal. Classic indicators are computed solely for UI display
 * and have zero influence on signal direction or confidence.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { Candle } from '../prices/prices.api.types';

// ── Indicators ────────────────────────────────────────────────────────────────
import {
  rsi,
  ema,
  macd,
  bollingerBands,
  atr,
  stochastic,
  adx,
  supertrend,
  ichimoku,
  williamsR,
  cci,
  type SupertrendResult,
  type IchimokuResult,
} from '../lib/indicators/classic';
import { obv, cvd, vwap } from '../lib/indicators/volume';

// ── SMC ─────────────────────────────────────────────────────────────────────
import { analyzeMarketStructure } from '../lib/smc/structure';
import {
  detectOrderBlocks,
  detectFVG,
  detectBreakerBlocks,
  findNearestZone,
} from '../lib/smc/zones';
import {
  analyzeFibonacci,
  isInGoldenPocket,
  getPriceZone,
} from '../lib/smc/fibonacci';
import { detectLiquidityLevels } from '../lib/smc/liquidity';
import type { Zone } from '../lib/smc/zones';
import type { FibLevels } from '../lib/smc/fibonacci';
import type { MarketStructureResult } from '../lib/smc/structure';
import type { LiquidityResult } from '../lib/smc/liquidity';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface TradePlan {
    entry: number;
    tp: number;
    sl: number;
    rr: number; // reward-to-risk
    atrVal: number;
}

export interface ScalpResult {
    symbol: string;
    side: 'BUY' | 'SELL' | 'HOLD';
    /** How the signal was derived: 'smc' = full zone confluence, 'trend-follow' = Supertrend+Ichimoku backbone */
    mode: 'smc' | 'trend-follow';
    confidence: number; // 0–100
    score: number; // raw weighted score
    reasons: string[];
    plan: TradePlan;

    // Enriched context for DB / WS consumers
    indicators: {
        rsi: number | null;
        ema9: number | null;
        ema21: number | null;
        macdHistogram: number | null;
        bbPercentB: number | null;
        atrVal: number | null;
        stochK: number | null;
        adxVal: number | null;
        obvTrend: string | null;
        cvdDivergence: boolean | null;
        vwapAbove: boolean | null;
        // Trend-follow indicators
        supertrendSignal: 'BUY' | 'SELL' | null;
        supertrendValue: number | null;
        supertrendDistPct: number | null;
        ichimokuSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
        ichimokuStrength: number | null;
        williamsR: number | null;
        cciVal: number | null;
    };
    smc: {
        trend: string;
        bias: string;
        lastBreak: string | null;
        nearestOb: Zone | null;
        nearestFvg: Zone | null;
        fibLevels: FibLevels | null;
        inGoldenPocket: boolean;
        priceZone: string;
        nearestBsl: number | null;
        nearestSsl: number | null;
        nearestBreaker: Zone | null;
    };
    mtfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

@Injectable()
export class ScalpService {
    private readonly logger = new Logger(ScalpService.name);

    /**
     * ICT / SMC pure price-action engine.
     *
     * Logic flow:
     *  1. HTF bias (1h structure) — MANDATORY gate.
     *  2. LTF (5m) must confirm the same direction via CHoCH or BoS.
     *  3. Price must be touching/inside an aligned OB / FVG / Breaker.
     *  4. Zone must sit in Premium (SELL) or Discount (BUY) — Fib-based.
     *  5. Liquidity sweep adds probability (smart-money confirmation).
     *  6. Displacement (strong impulsive candle) confirms institutional entry.
     *
     * Classic indicators (RSI, MACD, EMA …) are computed for display ONLY.
     */
    predict(
        symbol: string,
        candles: Candle[],
        candles1h?: Candle[],
    ): ScalpResult {
        if (!candles || candles.length < 60) {
            return this.holdResult(symbol, 'Insufficient data');
        }

        const price = candles[candles.length - 1].close;
        const atrVal = atr(candles) ?? price * 0.001;

        // ── Trend-follow indicators (computed once, always available) ────────
        const stResult: SupertrendResult | null = supertrend(candles, 10, 3);
        const ichiResult: IchimokuResult | null = ichimoku(candles);
        const wrResult = williamsR(candles);
        const cciResult = cci(candles);

        // Both indicators must agree for a valid trend-follow signal
        const trendFollowBias: 'BULLISH' | 'BEARISH' | null =
            stResult &&
            ichiResult &&
            ichiResult.signal !== 'NEUTRAL' &&
            ((stResult.signal === 'BUY' && ichiResult.signal === 'BULLISH') ||
                (stResult.signal === 'SELL' && ichiResult.signal === 'BEARISH'))
                ? stResult.signal === 'BUY'
                    ? 'BULLISH'
                    : 'BEARISH'
                : null;

        let signalMode: 'smc' | 'trend-follow' = 'smc';

        // ── SMC analysis on 5m ──────────────────────────────────────────────
        const msResult: MarketStructureResult = analyzeMarketStructure(candles);
        const orderBlocks = detectOrderBlocks(candles, 8);
        const fvgs = detectFVG(candles, 8);
        const breakers = detectBreakerBlocks(candles, 6);
        const fibResult = analyzeFibonacci(candles, 60);
        const liquidity: LiquidityResult = detectLiquidityLevels(candles);

        // ── Step 1: HTF bias — pure structure, zero indicators ───────────────
        let htfBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        let htfLastBreakType: string | null = null;

        if (candles1h && candles1h.length >= 30) {
            // lookback=8 on 1h bars reduces false swing points from intra-day noise
            const htfMs = analyzeMarketStructure(candles1h, 8);
            htfBias = htfMs.bias === 'NEUTRAL' ? 'NEUTRAL' : htfMs.bias;
            htfLastBreakType = htfMs.lastBreak
                ? `${htfMs.lastBreak.type} ${htfMs.lastBreak.direction}`
                : null;
        } else {
            // No 1h data → use 5m structure as HTF proxy
            htfBias = msResult.bias === 'NEUTRAL' ? 'NEUTRAL' : msResult.bias;
        }

        if (htfBias === 'NEUTRAL') {
            // Gate 1 bypass: Supertrend + Ichimoku both agree → trend-follow mode
            if (!trendFollowBias) {
                return this.holdResult(
                    symbol,
                    'HTF structure neutral — awaiting direction',
                );
            }
            htfBias = trendFollowBias;
            signalMode = 'trend-follow';
        }

        // ── Step 2: LTF must confirm HTF bias ────────────────────────────────
        const ltfAligned = msResult.bias === htfBias;
        const ltfBreakAligned = msResult.lastBreak?.direction === htfBias;

        if (!ltfAligned && !ltfBreakAligned) {
            // Gate 2 bypass: trend indicators override a conflicting LTF structure
            if (!trendFollowBias || trendFollowBias !== htfBias) {
                return this.holdResult(
                    symbol,
                    `LTF structure ${msResult.bias} conflicts with HTF ${htfBias}`,
                );
            }
            signalMode = 'trend-follow';
        }

        // ── Step 3: Zone detection (direction-aligned only) ──────────────────
        const alignedOBs = orderBlocks.filter((z) =>
            htfBias === 'BULLISH'
                ? z.type === 'BULLISH_OB'
                : z.type === 'BEARISH_OB',
        );
        const alignedFVGs = fvgs.filter((z) =>
            htfBias === 'BULLISH'
                ? z.type === 'BULLISH_FVG'
                : z.type === 'BEARISH_FVG',
        );
        const alignedBreakers = breakers.filter((z) =>
            htfBias === 'BULLISH'
                ? z.type === 'BULLISH_BREAKER'
                : z.type === 'BEARISH_BREAKER',
        );

        const nearestOb = findNearestZone(alignedOBs, price);
        const nearestFvg = findNearestZone(alignedFVGs, price);
        const nearestBreaker = findNearestZone(alignedBreakers, price);

        // Within 1.8× ATR of zone midpoint counts as "in the zone"
        const ATR_FACTOR = 1.8;
        const inOb =
            nearestOb !== null &&
            Math.abs(nearestOb.midpoint - price) <= atrVal * ATR_FACTOR;
        const inFvg =
            nearestFvg !== null &&
            Math.abs(nearestFvg.midpoint - price) <= atrVal * ATR_FACTOR;
        const inBreaker =
            nearestBreaker !== null &&
            Math.abs(nearestBreaker.midpoint - price) <= atrVal * ATR_FACTOR;

        if (!inOb && !inFvg && !inBreaker) {
            // Gate 3 bypass: trend indicators active → fire trend-follow signal
            if (!trendFollowBias || trendFollowBias !== htfBias) {
                return this.holdResult(
                    symbol,
                    'Price not near any aligned OB / FVG / Breaker',
                );
            }
            signalMode = 'trend-follow';
        }

        // ── Step 4–7: Confluence scoring ─────────────────────────────────────
        const reasons: string[] = [];
        let confluences = 0;

        // (a) Structural confluence already validated above
        reasons.push(
            `HTF ${htfBias}${htfLastBreakType ? ` · ${htfLastBreakType}` : ''}`,
        );
        confluences += 1;

        // (a2) Trend-follow indicator confluences
        if (stResult) {
            confluences += 2;
            reasons.push(
                `Supertrend ${stResult.signal} (dist ${stResult.distancePct > 0 ? '+' : ''}${stResult.distancePct.toFixed(2)}%)`,
            );
        }
        if (ichiResult && ichiResult.signal !== 'NEUTRAL') {
            confluences += ichiResult.strength >= 75 ? 2 : 1;
            reasons.push(
                `Ichimoku ${ichiResult.signal} (str ${ichiResult.strength})`,
            );
        }

        if (ltfBreakAligned && msResult.lastBreak) {
            const bkType = msResult.lastBreak.type; // 'BoS' | 'CHoCH'
            confluences += bkType === 'CHoCH' ? 2 : 1; // CHoCH > BoS
            reasons.push(
                `LTF ${bkType} ${htfBias} @ ${msResult.lastBreak.breakPrice.toFixed(2)}`,
            );
        } else {
            confluences += 1; // LTF bias aligned without fresh break
        }

        // (b) Zone quality
        if (inBreaker) {
            confluences += 2;
            reasons.push(
                `${htfBias} Breaker Block [${nearestBreaker!.bottom.toFixed(2)}–${nearestBreaker!.top.toFixed(2)}]${nearestBreaker!.tested ? ' re-tested' : ' fresh'}`,
            );
        }
        if (inOb) {
            const obFreshness =
                nearestOb!.mitigated < 0.1 ? 'pristine' : 'tested';
            confluences += obFreshness === 'pristine' ? 2 : 1;
            reasons.push(
                `${htfBias} OB [${nearestOb!.bottom.toFixed(2)}–${nearestOb!.top.toFixed(2)}] (${obFreshness})`,
            );
        }
        if (inFvg) {
            confluences += 1;
            reasons.push(
                `${htfBias} FVG [${nearestFvg!.bottom.toFixed(2)}–${nearestFvg!.top.toFixed(2)}]`,
            );
        }

        // OB + FVG overlap stacking (highest form of confluence)
        if (inOb && inFvg) {
            confluences += 1;
            reasons.push('OB + FVG overlap ★');
        }

        // (c) Premium / Discount alignment
        const priceZone = fibResult
            ? getPriceZone(price, fibResult)
            : 'EQUILIBRIUM';
        const inGoldenPocket = fibResult
            ? isInGoldenPocket(price, fibResult)
            : false;

        const correctZone =
            (htfBias === 'BULLISH' &&
                (priceZone === 'DISCOUNT' || inGoldenPocket)) ||
            (htfBias === 'BEARISH' &&
                (priceZone === 'PREMIUM' || inGoldenPocket));

        if (inGoldenPocket) {
            confluences += 2;
            reasons.push('Golden Pocket 0.618–0.65 ★');
        } else if (correctZone) {
            confluences += 1;
            reasons.push(`${priceZone} zone (aligned with ${htfBias})`);
        } else if (priceZone !== 'EQUILIBRIUM') {
            // Hard gate: SELL in DISCOUNT or BUY in PREMIUM violates the core SMC rule
            // (Smart money sells at PREMIUM, buys at DISCOUNT). No indicator override.
            return this.holdResult(
                symbol,
                `Zone conflict: ${htfBias} signal in ${priceZone} zone — awaiting price to reach ${htfBias === 'BEARISH' ? 'PREMIUM' : 'DISCOUNT'}`,
            );
        }

        // (d) Liquidity sweep (smart-money fingerprint)
        const recentCandles = candles.slice(-6);
        if (htfBias === 'BULLISH') {
            const sweptSsl = liquidity.ssl.some(
                (lvl) =>
                    recentCandles.some((c) => c.low < lvl.price * 1.001) &&
                    price > lvl.price,
            );
            if (sweptSsl) {
                confluences += 2;
                reasons.push('SSL swept → liquidity grab (bullish)');
            } else if (liquidity.nearestSsl) {
                reasons.push(
                    `Targeting SSL @ ${liquidity.nearestSsl.price.toFixed(2)} below`,
                );
            }
            if (liquidity.nearestBsl) {
                reasons.push(
                    `BSL target @ ${liquidity.nearestBsl.price.toFixed(2)}`,
                );
            }
        } else {
            const sweptBsl = liquidity.bsl.some(
                (lvl) =>
                    recentCandles.some((c) => c.high > lvl.price * 0.999) &&
                    price < lvl.price,
            );
            if (sweptBsl) {
                confluences += 2;
                reasons.push('BSL swept → liquidity grab (bearish)');
            } else if (liquidity.nearestBsl) {
                reasons.push(
                    `Targeting BSL @ ${liquidity.nearestBsl.price.toFixed(2)} above`,
                );
            }
            if (liquidity.nearestSsl) {
                reasons.push(
                    `SSL target @ ${liquidity.nearestSsl.price.toFixed(2)}`,
                );
            }
        }

        // (e) Displacement (strong impulsive candles in bias direction)
        const disp = this.detectDisplacement(candles, htfBias, atrVal);
        if (disp.confirmed) {
            confluences += 1;
            reasons.push(
                `${htfBias} displacement (${disp.strength.toFixed(1)}× avg body)`,
            );
        }

        // (f) Engulfing / pin-bar entry trigger
        const trigger = this.detectEntryTrigger(candles, htfBias);
        if (trigger) {
            confluences += 1;
            reasons.push(`${trigger} candle`);
        }

        // ── Minimum confluence gate ──────────────────────────────────────────
        // Trend-follow mode needs fewer SMC confluences (indicators supply the backbone)
        const REQUIRED = signalMode === 'trend-follow' ? 3 : 5;
        if (confluences < REQUIRED) {
            return this.holdResult(
                symbol,
                `Confluence ${confluences} below threshold ${REQUIRED}`,
            );
        }

        const side: 'BUY' | 'SELL' = htfBias === 'BULLISH' ? 'BUY' : 'SELL';
        // SMC: max 12 confluences. Trend-follow: max 16 (extra indicator points).
        const MAX_CONFLUENCES = signalMode === 'trend-follow' ? 16 : 12;
        const confidence = Math.min(
            95,
            Math.round(40 + (confluences / MAX_CONFLUENCES) * 55),
        );
        const score = (side === 'BUY' ? 1 : -1) * Math.round(confluences * 10);

        // ── Trade plan ───────────────────────────────────────────────────────
        const plan = this.buildTradePlan(
            side,
            price,
            atrVal,
            nearestOb,
            nearestFvg,
            nearestBreaker,
        );

        // ── Display-only indicators (no influence on signal) ─────────────────
        const rsiResult = rsi(candles);
        const ema9Val = ema(
            candles.map((c) => c.close),
            9,
        );
        const ema21Val = ema(
            candles.map((c) => c.close),
            21,
        );
        const macdResult = macd(candles);
        const bbResult = bollingerBands(candles);
        const stochResult = stochastic(candles);
        const adxResult = adx(candles);
        const obvResult = obv(candles);
        const cvdResult = cvd(candles);
        const vwapResult = vwap(candles);

        return {
            symbol,
            side,
            mode: signalMode,
            confidence,
            score,
            reasons,
            plan,
            indicators: {
                rsi: rsiResult?.rsi ?? null,
                ema9: ema9Val,
                ema21: ema21Val,
                macdHistogram: macdResult?.histogram ?? null,
                bbPercentB: bbResult?.percentB ?? null,
                atrVal,
                stochK: stochResult?.k ?? null,
                adxVal: adxResult?.adx ?? null,
                obvTrend: obvResult?.trend ?? null,
                cvdDivergence: cvdResult?.divergence ?? null,
                vwapAbove: vwapResult?.priceAbove ?? null,
                supertrendSignal: stResult?.signal ?? null,
                supertrendValue: stResult?.value ?? null,
                supertrendDistPct: stResult?.distancePct ?? null,
                ichimokuSignal: ichiResult?.signal ?? null,
                ichimokuStrength: ichiResult?.strength ?? null,
                williamsR: wrResult,
                cciVal: cciResult,
            },
            smc: {
                trend: msResult.trend,
                bias: msResult.bias,
                lastBreak: msResult.lastBreak
                    ? `${msResult.lastBreak.type} ${msResult.lastBreak.direction}`
                    : null,
                nearestOb: nearestOb ?? findNearestZone(orderBlocks, price),
                nearestFvg: nearestFvg ?? findNearestZone(fvgs, price),
                fibLevels: fibResult,
                inGoldenPocket,
                priceZone,
                nearestBsl: liquidity.nearestBsl?.price ?? null,
                nearestSsl: liquidity.nearestSsl?.price ?? null,
                nearestBreaker:
                    nearestBreaker ?? findNearestZone(breakers, price),
            },
            mtfBias: htfBias,
        };
    }

    // ── Displacement: ≥1 strong body candle in direction within last 4 bars ──

    private detectDisplacement(
        candles: Candle[],
        direction: 'BULLISH' | 'BEARISH',
        atrVal: number,
    ): { confirmed: boolean; strength: number } {
        if (candles.length < 5) return { confirmed: false, strength: 0 };

        const recent = candles.slice(-4);
        const avgBody =
            recent.reduce((s, c) => s + Math.abs(c.close - c.open), 0) /
            recent.length;
        if (avgBody === 0) return { confirmed: false, strength: 0 };

        // A displacement candle has a body ≥ 1.5× average AND moves in direction
        const candidates = recent.filter((c) => {
            const body = Math.abs(c.close - c.open);
            if (body < avgBody * 1.5) return false;
            return direction === 'BULLISH'
                ? c.close > c.open
                : c.close < c.open;
        });

        if (candidates.length === 0) return { confirmed: false, strength: 0 };

        const best = candidates.reduce((a, b) =>
            Math.abs(b.close - b.open) > Math.abs(a.close - a.open) ? b : a,
        );
        return {
            confirmed: true,
            strength: Math.abs(best.close - best.open) / avgBody,
        };
    }

    // ── Entry triggers (PA confirmation) ─────────────────────────────────────

    private detectEntryTrigger(
        candles: Candle[],
        direction: 'BULLISH' | 'BEARISH',
    ): string | null {
        if (candles.length < 3) return null;

        const [prev2, prev1, last] = candles.slice(-3);
        const body = Math.abs(last.close - last.open);
        const lWick = Math.min(last.open, last.close) - last.low;
        const uWick = last.high - Math.max(last.open, last.close);

        if (direction === 'BULLISH') {
            // Bullish engulfing
            if (
                last.close > last.open &&
                prev1.close < prev1.open &&
                last.close > prev1.open &&
                last.open < prev1.close
            )
                return 'Bullish engulfing';
            // Hammer / pin bar
            if (body > 0 && lWick > body * 2 && uWick < body * 0.5)
                return 'Hammer / pin bar';
            // Bullish rejection (close near high)
            if (last.close > last.open && last.close >= last.high * 0.995)
                return 'Bullish close near high';
        } else {
            // Bearish engulfing
            if (
                last.close < last.open &&
                prev1.close > prev1.open &&
                last.close < prev1.open &&
                last.open > prev1.close
            )
                return 'Bearish engulfing';
            // Shooting star
            if (body > 0 && uWick > body * 2 && lWick < body * 0.5)
                return 'Shooting star / pin bar';
            // Bearish rejection (close near low)
            if (last.close < last.open && last.close <= last.low * 1.005)
                return 'Bearish close near low';
        }

        // Prevent unused variable warning
        void prev2;

        return null;
    }

    // ─── Trade Plan Builder ───────────────────────────────────────────────────

    private buildTradePlan(
        side: 'BUY' | 'SELL' | 'HOLD',
        price: number,
        atrVal: number,
        nearestOb: Zone | null,
        nearestFvg: Zone | null,
        nearestBreaker: Zone | null = null,
    ): TradePlan {
        if (side === 'HOLD')
            return { entry: price, tp: price, sl: price, rr: 0, atrVal };

        const entry = price;
        let sl: number;
        let tp: number;

        if (side === 'BUY') {
            const breakerSupport =
                nearestBreaker?.type === 'BULLISH_BREAKER'
                    ? nearestBreaker
                    : null;
            const supportZone =
                breakerSupport ??
                [nearestOb, nearestFvg]
                    .filter(
                        (z): z is Zone =>
                            z !== null && z.type.startsWith('BULLISH'),
                    )
                    .sort((a, b) => b.bottom - a.bottom)[0];
            sl = supportZone
                ? Math.max(
                      supportZone.bottom - atrVal * 0.3,
                      entry - atrVal * 1.2,
                  )
                : entry - atrVal * 1.2;
            tp = entry + (entry - sl) * 2;
        } else {
            const breakerResist =
                nearestBreaker?.type === 'BEARISH_BREAKER'
                    ? nearestBreaker
                    : null;
            const resistanceZone =
                breakerResist ??
                [nearestOb, nearestFvg]
                    .filter(
                        (z): z is Zone =>
                            z !== null && z.type.startsWith('BEARISH'),
                    )
                    .sort((a, b) => a.top - b.top)[0];
            sl = resistanceZone
                ? Math.min(
                      resistanceZone.top + atrVal * 0.3,
                      entry + atrVal * 1.2,
                  )
                : entry + atrVal * 1.2;
            tp = entry - (sl - entry) * 2;
        }

        const risk = Math.abs(entry - sl);
        const reward = Math.abs(tp - entry);
        const rr = risk === 0 ? 0 : Math.round((reward / risk) * 100) / 100;

        return {
            entry: +entry.toFixed(4),
            tp: +tp.toFixed(4),
            sl: +sl.toFixed(4),
            rr,
            atrVal: +atrVal.toFixed(4),
        };
    }

    // ─── Fallback ─────────────────────────────────────────────────────────────

    private holdResult(symbol: string, reason: string): ScalpResult {
        return {
            symbol,
            side: 'HOLD',
            mode: 'smc',
            confidence: 0,
            score: 0,
            reasons: [reason],
            plan: { entry: 0, tp: 0, sl: 0, rr: 0, atrVal: 0 },
            indicators: {
                rsi: null,
                ema9: null,
                ema21: null,
                macdHistogram: null,
                bbPercentB: null,
                atrVal: null,
                stochK: null,
                adxVal: null,
                obvTrend: null,
                cvdDivergence: null,
                vwapAbove: null,
                supertrendSignal: null,
                supertrendValue: null,
                supertrendDistPct: null,
                ichimokuSignal: null,
                ichimokuStrength: null,
                williamsR: null,
                cciVal: null,
            },
            smc: {
                trend: 'RANGING',
                bias: 'NEUTRAL',
                lastBreak: null,
                nearestOb: null,
                nearestFvg: null,
                fibLevels: null,
                inGoldenPocket: false,
                priceZone: 'EQUILIBRIUM',
                nearestBsl: null,
                nearestSsl: null,
                nearestBreaker: null,
            },
            mtfBias: 'NEUTRAL',
        };
    }
}
