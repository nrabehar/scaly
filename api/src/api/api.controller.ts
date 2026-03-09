import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PricesService } from '../prices/prices.service';
import { SimulationService } from '../prices/simulation.service';
import { OrderbookService } from '../orderbook/orderbook.service';
import { ScalpService } from '../signals/scalp.service';
import { PrismaService } from '../persistence/prisma.service';
import { AiService } from '../ai/ai.service';

const INSTRUMENTS = [
    {
        symbol: 'XAU/USD',
        name: 'Gold',
        type: 'commodity' as const,
        pips: 0.01,
        minLot: 0.01,
    },
    {
        symbol: 'BTC/USD',
        name: 'Bitcoin',
        type: 'crypto' as const,
        pips: 0.01,
        minLot: 0.0001,
    },
    {
        symbol: 'ETH/USD',
        name: 'Ethereum',
        type: 'crypto' as const,
        pips: 0.01,
        minLot: 0.001,
    },
    {
        symbol: 'EUR/USD',
        name: 'Euro / US Dollar',
        type: 'forex' as const,
        pips: 0.0001,
        minLot: 0.01,
    },
    {
        symbol: 'GBP/USD',
        name: 'British Pound / US Dollar',
        type: 'forex' as const,
        pips: 0.0001,
        minLot: 0.01,
    },
];

@Controller('api')
export class ApiController {
    /** In-memory macro calendar cache: symbol → { data, cachedAt } */
    private readonly macroCache = new Map<
        string,
        { data: any; cachedAt: number }
    >();
    private readonly MACRO_TTL_MS = 60 * 60 * 1000; // 1 hour

    constructor(
        private prices: PricesService,
        private simulation: SimulationService,
        private orderbookService: OrderbookService,
        private scalpService: ScalpService,
        private prisma: PrismaService,
        private ai: AiService,
    ) {}

    @Get('price')
    async price(@Query('symbol') symbol = 'XAU/USD') {
        // Try primary providers via PricesService, fallback to simulation
        let tick: any = null;
        try {
            tick = await this.prices.fetchTick(symbol as any);
        } catch (e) {
            tick = null;
        }
        if (!tick) {
            const c = this.simulation.addSimulatedCandle(symbol);
            tick = {
                success: true,
                source: 'simulated',
                symbol,
                price: c.close,
                bid: c.close * 0.9999,
                ask: c.close * 1.0001,
                timestamp: Date.now(),
            };
        }
        return tick;
    }

    @Get('history')
    async history(
        @Query('symbol') symbol = 'XAU/USD',
        @Query('interval') interval = '1min',
        @Query('outputsize') outputsize = '200',
    ) {
        const size = parseInt(outputsize || '200', 10) || 200;
        try {
            const data = await this.prices.fetchHistory(
                symbol as any,
                interval,
                size,
            );
            if (data)
                return { success: true, source: 'provider', symbol, data };
        } catch (e) {}
        // fallback
        const hist = this.simulation.getHistory(symbol);
        return { success: true, source: 'simulated', symbol, data: hist };
    }

    @Get('orderbook')
    async orderbook(@Query('symbol') symbol = 'BTC/USD') {
        const ob = await this.orderbookService.fetchOrderbook(symbol);
        if (ob) return { success: true, ...ob };
        return { success: false, reason: 'not_available' };
    }

    @Get('news')
    async news(@Query('symbol') symbol = 'GLOBAL') {
        const where =
            symbol && symbol !== 'GLOBAL'
                ? { asset: { contains: symbol.split('/')[0] } }
                : {};
        const items = await this.prisma.processedNews.findMany({
            where,
            orderBy: { processedAt: 'desc' },
            take: 30,
            select: {
                id: true,
                title: true,
                source: true,
                url: true,
                asset: true,
                impact: true,
                label: true,
                confidence: true,
                processedAt: true,
            },
        });
        return { success: true, items };
    }

    @Get('multi-tf')
    async multiTf(@Query('symbol') symbol = 'XAU/USD') {
        const intervals = ['1min', '5min', '15min', '1h'];
        const out: Record<string, any> = {};
        for (const iv of intervals) {
            try {
                const data = await this.prices.fetchHistory(
                    symbol as any,
                    iv,
                    200,
                );
                out[iv] = { success: true, data };
            } catch (e) {
                out[iv] = { success: false, reason: 'fetch_failed' };
            }
        }
        return { success: true, symbol, frames: out };
    }

    @Get('instruments')
    instruments() {
        return { success: true, instruments: INSTRUMENTS };
    }

    @Get('macro-calendar')
    async macroCalendar(@Query('symbol') symbol = 'XAU/USD') {
        const cached = this.macroCache.get(symbol);
        if (cached && Date.now() - cached.cachedAt < this.MACRO_TTL_MS) {
            return cached.data;
        }

        const asset = symbol.split('/')[0] ?? 'XAU';
        const today = new Date().toISOString().split('T')[0];
        const prompt = `You are a forex/commodities macro economist. Today is ${today}.
List the 12 most important upcoming economic events this week that could impact ${symbol} (${asset}).
Return ONLY a raw JSON array (no markdown) like:
[{"id":"unique-id","title":"Event Name","country":"US","flag":"🇺🇸","importance":"high|medium|low","previous":"3.1%","expected":"2.9%","actual":null,"timestamp":1234567890000,"status":"upcoming","impact":"bullish|bearish|neutral"}]
Rules:
- timestamp must be a real Unix ms epoch for the correct date/time this week
- importance: high=NFP/CPI/FOMC/Fed, medium=PMI/GDP/Retail, low=speeches
- impact: how the event typically affects ${asset} price
- status: 'upcoming' if in the future, 'past' if already released today
- actual: fill only if event already happened today
- Include US, EU, UK events primarily. Max 12 events sorted by timestamp asc.`;

        try {
            const res = await this.ai.callAI(prompt, 'groq');
            const raw = res?.result?.signal as any;
            let events: any[] = [];
            if (Array.isArray(raw)) {
                events = raw;
            } else if (typeof raw === 'string') {
                try {
                    events = JSON.parse(raw);
                } catch {
                    events = [];
                }
            }

            const data = {
                success: true,
                symbol,
                source: 'ai-generated',
                generatedAt: new Date().toISOString(),
                total: events.length,
                events,
            };
            this.macroCache.set(symbol, { data, cachedAt: Date.now() });
            return data;
        } catch {
            // Return empty on AI failure — frontend handles gracefully
            return {
                success: false,
                symbol,
                source: 'ai-generated',
                events: [],
            };
        }
    }

    @Get('health')
    health() {
        return {
            success: true,
            status: 'ok',
            uptime: process.uptime(),
            ts: Date.now(),
        };
    }

    @Post('scalp-3m')
    async scalp3m(@Body() body: { symbol?: string; candles?: any[] }) {
        const symbol = body?.symbol || 'XAU/USD';
        let candles = body?.candles;
        if (!candles || !candles.length) {
            // fetch from history API
            try {
                const data = await this.prices.fetchHistory(
                    symbol as any,
                    '1min',
                    200,
                );
                candles = data as any[];
            } catch {
                candles = this.simulation.getHistory(symbol);
            }
        }
        const result = this.scalpService.predict(symbol, candles);
        return { success: true, ...result };
    }
}
