import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval, Cron } from '@nestjs/schedule';
import { WsGateway } from '../ws/ws.gateway';
import { PricesService } from '../prices/prices.service';
import { OrderbookService } from '../orderbook/orderbook.service';
import { ScalpService } from '../signals/scalp.service';
import { SignalsService } from '../signals/signals.service';
import { AiService } from '../ai/ai.service';
import type { MarketPair } from '../prices/prices.api.types';
import type { ScalpResult } from '../signals/scalp.service';

const SYMBOLS: MarketPair[] = [
    'BTC/USD',
    'ETH/USD',
    'XAU/USD',
    'EUR/USD',
    'GBP/USD',
];
const ORDERBOOK_SYMBOLS: MarketPair[] = ['BTC/USD', 'ETH/USD'];

interface AiAgentResult {
    conviction: string;
    smcCommentary?: string;
    entryTiming?: string;
    invalidation?: string;
    targetLiquidity?: string;
    keyRisk?: string;
}

interface AiConsensus {
    conviction: 'HIGH' | 'MEDIUM' | 'LOW' | 'CONFLICT';
    sideAgreement: boolean;
    agents: { model: string; conviction: string }[];
    smcCommentary?: string;
    entryTiming?: string;
    invalidation?: string;
    targetLiquidity?: string;
    keyRisk?: string;
}

@Injectable()
export class StreamsService implements OnModuleInit {
    private readonly logger = new Logger(StreamsService.name);

    /** Tracks the price at which we last ran a full analysis per symbol. */
    private readonly lastAnalyzedPrice = new Map<string, number>();
    /** ms timestamp of last analysis per symbol. */
    private readonly lastAnalyzedAt = new Map<string, number>();
    /** Prevents concurrent parallel analyses for the same symbol. */
    private readonly analyzing = new Set<string>();
    /** Timestamp of the last successful AI call per symbol (to rate-limit AI usage). */
    private readonly lastAiCallAt = new Map<string, number>();
    /** Minimum ms between AI calls per symbol (10 minutes). */
    private readonly AI_COOLDOWN_MS = 10 * 60 * 1000;
    /** Timestamp of the last persisted signal per symbol — deduplication guard. */
    private readonly lastSavedSignalAt = new Map<string, number>();
    /**
     * Minimum ms between two saved signals for the same symbol.
     * 5 minutes: prevents signal spam from the every-60s cron + price trigger
     * firing in the same window and producing near-identical entries.
     */
    private readonly MIN_SIGNAL_INTERVAL_MS = 5 * 60 * 1000;

    constructor(
        private readonly ws: WsGateway,
        private readonly prices: PricesService,
        private readonly orderbookService: OrderbookService,
        private readonly scalp: ScalpService,
        private readonly signals: SignalsService,
        private readonly ai: AiService,
    ) {}

    // ── Module init — wire on-demand signal requests from WebSocket clients ──

    onModuleInit() {
        this.ws.registerSignalRequestHandler(
            (symbol: string, clientId: string) => {
                // forceAi=true: client explicitly requested — bypass cooldown
                void this.analyzeSymbolNow(
                    symbol as MarketPair,
                    clientId,
                    true,
                );
            },
        );
    }

    // ── Price ticker ─────────────────────────────────────────────────────────

    @Interval(2000)
    async streamPrices() {
        for (const symbol of SYMBOLS) {
            try {
                const tick = await this.prices.fetchTick(symbol);
                if (!tick) {
                    this.logger.error(
                        `fetchTick(${symbol}) returned null — skipping`,
                    );
                    continue;
                }
                this.ws.broadcastPrice(symbol, tick);

                // Price-triggered re-analysis: significant move AND no recent analysis
                const lastPrice = this.lastAnalyzedPrice.get(symbol);
                const lastAt = this.lastAnalyzedAt.get(symbol) ?? 0;
                const now = Date.now();
                const priceDelta = lastPrice
                    ? Math.abs(tick.price - lastPrice) / lastPrice
                    : 1;

                if (priceDelta > 0.002 && now - lastAt > 30_000) {
                    this.logger.debug(
                        `Price-triggered reanalysis ${symbol} Δ=${(priceDelta * 100).toFixed(3)}%`,
                    );
                    void this.analyzeSymbolNow(symbol);
                }
            } catch (e: unknown) {
                this.logger.error(
                    `streamPrices(${symbol}) error`,
                    e instanceof Error ? e.message : String(e),
                );
            }
        }
    }

    // ── Order book ───────────────────────────────────────────────────────────

    @Interval(5000)
    async streamOrderbook() {
        for (const symbol of ORDERBOOK_SYMBOLS) {
            try {
                const ob = await this.orderbookService.fetchOrderbook(symbol);
                if (ob) this.ws.broadcastOrderbook(symbol, ob);
            } catch (e: unknown) {
                this.logger.error(
                    `streamOrderbook(${symbol}) error`,
                    e instanceof Error ? e.message : String(e),
                );
            }
        }
    }

    // ── SMC + Multi-agent signal generation — every minute ───────────────────

    @Cron('* * * * *')
    async generateSignals() {
        await Promise.allSettled(
            SYMBOLS.map((symbol) => this.analyzeSymbolNow(symbol)),
        );
    }

    /**
     * Run the full SMC + AI pipeline for one symbol.
     * If `targetClientId` is provided the result is also pushed directly to that client
     * (on-demand request path). The cron path keeps `targetClientId` undefined and
     * only broadcasts to all subscribers of that symbol.
     */
    async analyzeSymbolNow(
        symbol: MarketPair,
        targetClientId?: string,
        /** When true (on-demand client request), bypass the AI cooldown. */
        forceAi = false,
    ): Promise<void> {
        // Debounce: skip if an analysis for this symbol is already running
        if (this.analyzing.has(symbol)) {
            if (targetClientId) {
                // Still let the client know they'll get a result soon
                this.ws.broadcastAnalyzing(targetClientId, symbol);
            }
            return;
        }
        this.analyzing.add(symbol);

        // Notify requesting client that analysis has started
        if (targetClientId) {
            this.ws.broadcastAnalyzing(targetClientId, symbol);
        }

        try {
            // 1. Fetch candles (5m primary TF + 1h for MTF bias)
            const candles5m = await this.prices.fetchHistory(symbol, '5', 200);
            if (!candles5m || candles5m.length < 30) {
                this.logger.warn(
                    `analyzeSymbolNow(${symbol}): insufficient candles`,
                );
                return;
            }

            let candles1h: typeof candles5m | undefined;
            try {
                // 200 × 1h = ~8 days — long enough to see a full macro swing cycle
                candles1h = await this.prices.fetchHistory(symbol, '60', 200);
            } catch {
                // MTF optional — continue without
            }

            // 2. Run SMC engine
            const result = this.scalp.predict(symbol, candles5m, candles1h);

            // Track this as the latest analyzed price (regardless of HOLD)
            this.lastAnalyzedPrice.set(symbol, result.plan?.entry ?? 0);
            this.lastAnalyzedAt.set(symbol, Date.now());

            if (result.side === 'HOLD') {
                // Broadcast the hold reason so the UI can tell the user why
                const holdReason = result.reasons[0] ?? 'No valid setup';
                this.ws.broadcastHold(symbol, holdReason);
                return;
            }

            // 3. Build AI prompt — respect cooldown unless client explicitly asked
            const lastAi = this.lastAiCallAt.get(symbol) ?? 0;
            const aiReady =
                forceAi || Date.now() - lastAi > this.AI_COOLDOWN_MS;
            let aiConsensus: AiConsensus | null = null;
            if (aiReady) {
                const prompt = this.buildSmcPrompt(symbol, result);
                aiConsensus = await this.runAiConsensus(prompt);
                if (aiConsensus) this.lastAiCallAt.set(symbol, Date.now());
            } else {
                const waitMin = Math.ceil(
                    (this.AI_COOLDOWN_MS - (Date.now() - lastAi)) / 60000,
                );
                this.logger.debug(
                    `AI cooldown active for ${symbol} — ${waitMin}m remaining`,
                );
            }

            // 4. Determine final conviction —
            //    If AI conflicts with SMC direction → downgrade or skip
            const finalSide = this.resolveFinalSide(result, aiConsensus);
            if (!finalSide) {
                this.logger.debug(
                    `analyzeSymbolNow(${symbol}): AI conflicts with SMC — skipped`,
                );
                return;
            }

            // 5. Persist enriched signal — skip if we saved one too recently
            //    (deduplicates cron + price-trigger + on-demand client requests).
            //    forceAi only bypasses the AI cooldown, NOT the save dedup.
            const lastSaved = this.lastSavedSignalAt.get(symbol) ?? 0;
            if (Date.now() - lastSaved < this.MIN_SIGNAL_INTERVAL_MS) {
                this.logger.debug(
                    `analyzeSymbolNow(${symbol}): dedup — signal saved ${Math.round((Date.now() - lastSaved) / 1000)}s ago, skipping`,
                );
                // Still broadcast so connected clients see the latest signal
                const broadcast = { ...result, side: finalSide, aiConsensus };
                this.ws.broadcastSignal(symbol, broadcast);
                if (targetClientId) {
                    this.ws.broadcastSignalToClient(
                        targetClientId,
                        symbol,
                        broadcast,
                    );
                }
                return;
            }

            const saved = await this.signals.saveSignal({
                symbol,
                signal: finalSide,
                provider: 'smc+ai-consensus',
                score: result.score,
                metadata: {
                    confidence: result.confidence,
                    reasons: result.reasons,
                    plan: result.plan,
                    indicators: result.indicators,
                    smc: result.smc,
                    mtfBias: result.mtfBias,
                    aiConsensus,
                },
            });

            // Mark the save time for deduplication
            this.lastSavedSignalAt.set(symbol, Date.now());

            // 6. Broadcast enriched signal
            const broadcast = {
                ...result,
                side: finalSide,
                id: saved.id,
                aiConsensus,
            };

            // Always broadcast to all subscribers of this symbol
            this.ws.broadcastSignal(symbol, broadcast);

            // If this was a direct client request, also push directly to that client
            // (handles the case where they switched to this symbol just now and won't
            //  have been in the subscriber list until the subscribe event settled)
            if (targetClientId) {
                this.ws.broadcastSignalToClient(
                    targetClientId,
                    symbol,
                    broadcast,
                );
            }

            this.logger.log(
                `Signal [${finalSide}] ${symbol} conf=${result.confidence}% score=${result.score} ai=${aiConsensus?.conviction ?? 'n/a'}${targetClientId ? ' [on-demand]' : ''}`,
            );
        } catch (e: unknown) {
            this.logger.error(
                `analyzeSymbolNow(${symbol}) error`,
                e instanceof Error ? e.message : String(e),
            );
        } finally {
            this.analyzing.delete(symbol);
        }
    }

    // ── Auto-resolve pending signals (TP/SL hit detection) ──────────────────

    @Cron('30 * * * * *') // 30 s past each minute — staggered from signal generation
    async autoResolveSignals() {
        const pending = await this.signals.loadPendingSignals();
        if (pending.length === 0) return;

        for (const sig of pending) {
            const meta = sig.metadata as any;
            const plan = meta?.plan as
                | { entry?: number; tp?: number; sl?: number }
                | undefined;
            if (!plan?.tp || !plan?.sl) continue;

            try {
                const tick = await this.prices.fetchTick(
                    sig.symbol as MarketPair,
                );
                if (!tick?.price) continue;
                const price = tick.price;

                let outcome: string | null = null;
                if (sig.signal === 'BUY') {
                    if (price >= plan.tp) outcome = 'WIN';
                    else if (price <= plan.sl) outcome = 'LOSS';
                } else if (sig.signal === 'SELL') {
                    if (price <= plan.tp) outcome = 'WIN';
                    else if (price >= plan.sl) outcome = 'LOSS';
                }

                if (outcome) {
                    await this.signals.resolveSignal(sig.id, outcome);
                    this.ws.broadcastSignalResolved(
                        sig.id,
                        sig.symbol,
                        outcome,
                    );
                    this.logger.log(
                        `Auto-resolved #${sig.id} ${sig.symbol} [${sig.signal}] → ${outcome} @ ${price.toFixed(2)}`,
                    );
                }
            } catch (e) {
                this.logger.debug(
                    `autoResolveSignals(#${sig.id}): ${e instanceof Error ? e.message : String(e)}`,
                );
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Build SMC-focused prompt for AI agents. */
    private buildSmcPrompt(symbol: string, r: ScalpResult): string {
        const { smc, indicators, plan, side, confidence, reasons, mtfBias } = r;
        const ob = smc.nearestOb as any;
        const fvg = smc.nearestFvg as any;
        const breaker = (smc as any).nearestBreaker as any;
        const obStr = ob
            ? `${ob.type} [${ob.bottom?.toFixed(2)}–${ob.top?.toFixed(2)}] (${ob.mitigated === 0 ? 'pristine' : 'tested'})`
            : 'None nearby';
        const fvgStr = fvg
            ? `${fvg.type} [${fvg.bottom?.toFixed(2)}–${fvg.top?.toFixed(2)}]`
            : 'None nearby';
        const breakerStr = breaker
            ? `${breaker.type} [${breaker.bottom?.toFixed(2)}–${breaker.top?.toFixed(2)}] mid=${breaker.midpoint?.toFixed(2)} ${breaker.tested ? '(re-tested)' : '(fresh)'}`
            : 'None';

        // Compact prompt — minimises token usage while preserving all key context
        return `SMC analyst. ${symbol} @ ${plan.entry}. ENGINE: ${side} ${confidence}% (score ${r.score})
Structure: ${smc.trend}/${smc.bias} | Break: ${smc.lastBreak ?? 'none'} | Zone: ${smc.priceZone}${smc.inGoldenPocket ? '★GP' : ''} | HTF: ${mtfBias}
BSL:${smc.nearestBsl != null ? (smc.nearestBsl as number).toFixed(2) : '-'} SSL:${smc.nearestSsl != null ? (smc.nearestSsl as number).toFixed(2) : '-'}
OB:${obStr} | FVG:${fvgStr} | BB:${breakerStr}
Plan: E${plan.entry} TP${plan.tp} SL${plan.sl} RR${plan.rr}
Reasons: ${reasons.slice(0, 6).join('; ')}
JSON only — no markdown: {"conviction":"HIGH|MEDIUM|LOW","smcCommentary":"<2 sentences>","entryTiming":"<1 sentence>","invalidation":"<1 sentence>","targetLiquidity":"<level>","keyRisk":"<1 sentence>"}`;
    }

    /**
     * Call AI providers SEQUENTIALLY (not parallel) to save tokens.
     * Tries Groq first (faster), then Gemini as fallback.
     * Stops as soon as one provider replies successfully.
     */
    private async runAiConsensus(prompt: string): Promise<AiConsensus | null> {
        const modelOrder = ['groq', 'gemini'];
        const agents: {
            model: string;
            conviction: string;
            result: AiAgentResult | null;
        }[] = [];

        for (const model of modelOrder) {
            const res = await this.ai.callAI(prompt, model);
            if (res?.result?.signal) {
                agents.push({
                    model,
                    conviction:
                        (res.result.signal as AiAgentResult).conviction ??
                        'MEDIUM',
                    result: res.result.signal as AiAgentResult,
                });
                break; // one successful response is enough
            }
        }

        if (agents.length === 0) return null;

        // Determine consensus conviction
        const convictions = agents.map((a) =>
            (a.conviction ?? '').toUpperCase(),
        );
        const highCount = convictions.filter((c) => c === 'HIGH').length;
        const lowCount = convictions.filter((c) => c === 'LOW').length;

        let conviction: AiConsensus['conviction'] = 'MEDIUM';
        if (highCount === agents.length) conviction = 'HIGH';
        else if (lowCount === agents.length) conviction = 'LOW';
        else if (highCount > 0 && lowCount > 0) conviction = 'CONFLICT';

        // Use the best agent's commentary (prefer HIGH conviction agent)
        const bestAgent =
            agents.find((a) => (a.conviction ?? '').toUpperCase() === 'HIGH') ??
            agents[0];
        const commentary = bestAgent.result;

        return {
            conviction,
            sideAgreement: true, // SMC engine already filtered direction
            agents: agents.map((a) => ({
                model: a.model,
                conviction: a.conviction,
            })),
            smcCommentary: commentary?.smcCommentary,
            entryTiming: commentary?.entryTiming,
            invalidation: commentary?.invalidation,
            targetLiquidity: commentary?.targetLiquidity,
            keyRisk: commentary?.keyRisk,
        };
    }

    /**
     * Decide the final signal side.
     *
     * Gate logic (tightened):
     *   - No AI (cooldown or failure)  → require ≥70% confidence
     *   - AI CONFLICT or LOW          → require ≥80% confidence (rare edge)
     *   - AI MEDIUM                   → require ≥65% confidence
     *   - AI HIGH                     → require ≥60% confidence
     *
     * The SMC engine sets confidence = 40 + (confluences/12)*55, so:
     *   ≥60% ≈ ≥5.4 confluences (High AI)
     *   ≥65% ≈ ≥6.5 confluences (Medium AI)
     *   ≥70% ≈ ≥7.6 confluences (No AI)
     */
    private resolveFinalSide(
        result: ScalpResult,
        consensus: AiConsensus | null,
    ): 'BUY' | 'SELL' | null {
        const tf = result.mode === 'trend-follow';

        if (!consensus) {
            // No AI: SMC needs strong confluence; trend-follow needs moderate
            return result.confidence >= (tf ? 58 : 70)
                ? (result.side as 'BUY' | 'SELL')
                : null;
        }
        if (
            consensus.conviction === 'CONFLICT' ||
            consensus.conviction === 'LOW'
        ) {
            // Conflicting AI: require high confidence regardless of mode
            return result.confidence >= (tf ? 65 : 80)
                ? (result.side as 'BUY' | 'SELL')
                : null;
        }
        if (consensus.conviction === 'MEDIUM') {
            return result.confidence >= (tf ? 54 : 65)
                ? (result.side as 'BUY' | 'SELL')
                : null;
        }
        // HIGH conviction
        return result.confidence >= (tf ? 50 : 60)
            ? (result.side as 'BUY' | 'SELL')
            : null;
    }
}
