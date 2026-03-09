import { Injectable } from '@nestjs/common';
import { KrakenApi } from './kraken.api';
import type { MarketPair } from './prices.api.types';
import { TradingViewApi } from './tradingview.api';
import {
    YahooFinanceApi,
    type YahooInterval,
    type YahooRange,
} from './yahoo-finance.api';

const XAU = 'XAU/USD';
const FOREX_PAIRS: MarketPair[] = ['EUR/USD', 'GBP/USD'];
const FOREX_YAHOO_SYMBOLS: Record<string, string> = {
    'EUR/USD': 'EURUSD=X',
    'GBP/USD': 'GBPUSD=X',
};

/** Frontend timeframe strings → Kraken interval (minutes as string) */
const KRAKEN_INTERVAL: Record<string, string> = {
    '1min': '1',
    '1': '1',
    '5min': '5',
    '5': '5',
    '15min': '15',
    '15': '15',
    '30min': '30',
    '30': '30',
    '1h': '60',
    '60': '60',
    '2h': '120',
    '120': '120',
    '4h': '240',
    '240': '240',
    '1d': '1440',
    '1440': '1440',
};

/** Frontend/Kraken timeframe strings → Yahoo Finance interval */
const YAHOO_INTERVAL: Record<string, YahooInterval> = {
    '1min': '1m',
    '1': '1m',
    '5min': '5m',
    '5': '5m',
    '15min': '15m',
    '15': '15m',
    '30min': '30m',
    '30': '30m',
    '1h': '1h',
    '60': '1h',
    '2h': '1h',
    '120': '1h',
    '4h': '1h',
    '240': '1h',
    '1d': '1d',
    '1440': '1d',
};

/** Yahoo interval → appropriate historic range */
const YAHOO_RANGE: Record<string, YahooRange> = {
    '1m': '5d',
    '5m': '5d',
    '15m': '5d',
    '30m': '5d',
    '1h': '1mo',
    '1d': '1y',
};

@Injectable()
export class PricesService {
    constructor(
        private readonly kraken: KrakenApi,
        private readonly tradingView: TradingViewApi,
        private readonly yahooFinance: YahooFinanceApi,
    ) {}

    /** Returns the latest tick. XAU → TradingView, forex → Yahoo Finance, others → Kraken. */
    async fetchTick(symbol: MarketPair) {
        if (symbol === XAU) return this.tradingView.fetchTick();
        if (FOREX_PAIRS.includes(symbol)) {
            const price = await this.yahooFinance.fetchForexTick(symbol);
            if (!price) return null;
            const spread = price * 0.00008;
            return {
                price,
                bid: price - spread / 2,
                ask: price + spread / 2,
                timestamp: Date.now(),
                source: 'yahoo-finance',
                symbol,
                success: true,
            };
        }
        return this.kraken.fetchTick(symbol);
    }

    /** Returns OHLCV history. XAU/forex → Yahoo Finance, others → Kraken. */
    async fetchHistory(
        symbol: MarketPair,
        interval: string,
        outputsize: number,
    ) {
        if (symbol === XAU) {
            const yahooInterval: YahooInterval =
                YAHOO_INTERVAL[interval] ?? '1h';
            const range: YahooRange = YAHOO_RANGE[yahooInterval] ?? '1mo';
            return (
                (await this.yahooFinance.fetchHistory(
                    'GC=F',
                    yahooInterval,
                    range,
                )) ?? []
            );
        }
        if (FOREX_PAIRS.includes(symbol)) {
            const yahooSym = FOREX_YAHOO_SYMBOLS[symbol];
            const yahooInterval: YahooInterval =
                YAHOO_INTERVAL[interval] ?? '1h';
            const range: YahooRange = YAHOO_RANGE[yahooInterval] ?? '1mo';
            return (
                (await this.yahooFinance.fetchHistory(
                    yahooSym,
                    yahooInterval,
                    range,
                )) ?? []
            );
        }
        const krakenInterval = KRAKEN_INTERVAL[interval] ?? interval;
        return this.kraken.fetchHistory(symbol, krakenInterval, outputsize);
    }

    async fetchYahooHistory(
        symbol: string,
        interval: YahooInterval,
        range: YahooRange,
    ) {
        return this.yahooFinance.fetchHistory(symbol, interval, range);
    }
}
