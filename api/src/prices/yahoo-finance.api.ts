import { Injectable, Logger } from '@nestjs/common';
import YahooFinance from 'yahoo-finance2';
import type { Candle } from './prices.api.types';

const yahooFinance = new YahooFinance();

export type YahooInterval =
    | '1m'
    | '2m'
    | '5m'
    | '15m'
    | '30m'
    | '60m'
    | '90m'
    | '1h'
    | '1d'
    | '5d'
    | '1wk'
    | '1mo'
    | '3mo';
export type YahooRange =
    | '1d'
    | '5d'
    | '1mo'
    | '3mo'
    | '6mo'
    | '1y'
    | '2y'
    | '5y'
    | '10y'
    | 'ytd'
    | 'max';

export const YAHOO_FINANCE_INTERVALS: Record<string, YahooInterval> = {
    '1min': '1m',
    '2min': '2m',
    '5min': '5m',
    '15min': '15m',
    '30min': '30m',
    '60min': '60m',
    '90min': '90m',
    '1h': '1h',
    '1d': '1d',
    '5d': '5d',
    '1wk': '1wk',
    '1mo': '1mo',
    '3mo': '3mo',
};
export const YAHOO_FINANCE_RANGES: Record<YahooRange, () => Date> = {
    '1d': () => new Date(Date.now() - 24 * 60 * 60 * 1000),
    '5d': () => new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    '1mo': () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    '3mo': () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    '6mo': () => new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    '1y': () => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    '2y': () => new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
    '5y': () => new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
    '10y': () => new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000),
    ytd: () => new Date(new Date().getFullYear(), 0, 1),
    max: () => new Date(1978, 0, 1),
};

export const YAHOO_FINANCE_INTERVAL_MAX_RANGE_REQUEST: Record<
    YahooInterval,
    YahooRange
> = {
    '1m': '5d',
    '2m': '5d',
    '5m': '5d',
    '15m': '5d',
    '30m': '5d',
    '60m': '5d',
    '90m': '5d',
    '1h': '1mo',
    '1d': '1y',
    '5d': '2y',
    '1wk': '5y',
    '1mo': '10y',
    '3mo': 'max',
};

const FOREX_YAHOO: Partial<Record<string, string>> = {
    'EUR/USD': 'EURUSD=X',
    'GBP/USD': 'GBPUSD=X',
};

@Injectable()
export class YahooFinanceApi {
    private readonly logger = new Logger(YahooFinanceApi.name);
    private readonly CacheMS = 60_000;
    private readonly TickCacheMS = 5_000;
    private CacheHistory: Map<string, { timestamp: number; data: Candle[] }> =
        new Map();
    private CacheTick: Map<string, { timestamp: number; price: number }> =
        new Map();

    async fetchForexTick(symbol: string): Promise<number | null> {
        const yahooSym = FOREX_YAHOO[symbol];
        if (!yahooSym) return null;

        const cached = this.CacheTick.get(yahooSym);
        if (cached && Date.now() - cached.timestamp < this.TickCacheMS) {
            return cached.price;
        }

        try {
            const quote = await yahooFinance.quote(yahooSym);
            const price = quote?.regularMarketPrice ?? null;
            if (price) {
                this.CacheTick.set(yahooSym, { timestamp: Date.now(), price });
            }
            return price;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(
                `Yahoo Finance fetchForexTick(${yahooSym}) failed: ${msg}`,
            );
            return null;
        }
    }

    async fetchHistory(
        symbol: string = 'GC=F',
        interval: YahooInterval = '1h',
        range: YahooRange = '1y',
    ): Promise<Candle[] | null> {
        const cacheKey = `${symbol}_${interval}_${range}`;
        const cached = this.CacheHistory.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CacheMS) {
            return cached.data;
        }

        const endDate = new Date();
        const maxRangeKey = YAHOO_FINANCE_INTERVAL_MAX_RANGE_REQUEST[interval];
        const startDate = (
            YAHOO_FINANCE_RANGES[maxRangeKey] ?? YAHOO_FINANCE_RANGES[range]
        )();

        try {
            const raw = (await yahooFinance.chart(symbol, {
                interval,
                period1: startDate,
                period2: endDate,
            })) as {
                quotes: {
                    date: Date;
                    open: number | null;
                    high: number | null;
                    low: number | null;
                    close: number | null;
                    volume: number | null;
                }[];
            };
            const data: Candle[] = raw.quotes
                .filter((q) => q.close !== null)
                .map((q) => ({
                    time: q.date.getTime(), // milliseconds — consistent with Kraken
                    open: q.open ?? 0,
                    high: q.high ?? 0,
                    low: q.low ?? 0,
                    close: q.close as number,
                    volume: q.volume ?? 0,
                }));
            data.sort((a, b) => a.time - b.time);
            this.CacheHistory.set(cacheKey, { timestamp: Date.now(), data });
            return data;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(
                `Yahoo Finance fetchHistory(${symbol} ${interval} ${range}) failed: ${msg}`,
            );
        }
        return null;
    }
}
