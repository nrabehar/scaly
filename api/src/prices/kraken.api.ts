import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  Candle,
  CandleHistory,
  IPriceAPI,
  MarketPair,
} from './prices.api.types';
import fetch from 'node-fetch';

interface KrakenTickerResult {
    a: [string, string, string]; // Ask: [price, whole lot volume, lot volume]
    b: [string, string, string]; // Bid: [price, whole lot volume, lot volume]
    v: [string, string]; // Volume: [today, last 24 hours]
}

interface KrakenTickerResponse {
    error: string[];
    result?: Record<string, KrakenTickerResult>;
}

// Format exact Kraken: [time, open, high, low, close, vwap, volume, count]
type KrakenOHLCEntry = [
    number,
    string,
    string,
    string,
    string,
    string,
    string,
    number,
];

interface KrakenOHLCResponse {
    error: string[];
    result?: {
        [pair: string]: KrakenOHLCEntry[] | number | string | undefined;
        last?: number;
    };
}

@Injectable()
export class KrakenApi implements IPriceAPI {
    readonly SYMBOLS: Partial<Record<MarketPair, string>> = {
        'XAU/USD': 'XAUTZUSD',
        'BTC/USD': 'XXBTZUSD',
        'ETH/USD': 'XETHZUSD',
        'EUR/USD': 'ZEURZUSD',
        'GBP/USD': 'ZGBPZUSD',
    };

    private readonly CacheMS = 15000;
    private CacheHistory: Map<string, CandleHistory> = new Map();
    private readonly TickURL = `https://api.kraken.com/0/public/Ticker`;
    private readonly HistoryURL = `https://api.kraken.com/0/public/OHLC`;

    private readonly logger = new Logger(KrakenApi.name);

    async fetchTick(symbol: MarketPair) {
        const pair = this.getSymbol(symbol);
        if (!pair) {
            throw new BadRequestException(
                `Paire de symboles non supportée : ${symbol}`,
            );
        }

        try {
            const url = `${this.TickURL}?pair=${pair}`;
            const res = await fetch(url);
            const data = (await res.json()) as KrakenTickerResponse;

            // 1. Vérification des erreurs de l'API Kraken
            if (data.error && data.error.length > 0) {
                throw new Error(`Erreur API Kraken: ${data.error.join(', ')}`);
            }

            if (data.result) {
                const key = Object.keys(data.result)[0];
                const tick = data.result[key];
                const bid = parseFloat(tick.b[0]);
                const ask = parseFloat(tick.a[0]);
                const price = (bid + ask) / 2;

                this.logger.debug(`Kraken tick ${symbol}: $${price}`);

                return {
                    price,
                    bid,
                    ask,
                    spread: ask - bid,
                    volume: parseFloat(tick.v[1]),
                    timestamp: Date.now(),
                };
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`Échec du tick Kraken pour ${symbol}: ${msg}`);
        }
        return null;
    }

    async fetchHistory(
        symbol: MarketPair,
        interval: string = '1min',
        outputsize: number = 200,
    ): Promise<Candle[]> {
        const pair = this.getSymbol(symbol);
        if (!pair) {
            throw new BadRequestException(
                `Paire de symboles non supportée : ${symbol}`,
            );
        }

        const cacheKey = `kraken:${symbol}:${interval}`;
        const inCache = this.CacheHistory.get(cacheKey);
        const now = Date.now();

        if (inCache && now - inCache.timestamp < this.CacheMS) {
            return inCache.data;
        }

        const intervalMap: Record<string, number> = {
            // Frontend format
            '1min': 1,
            '5min': 5,
            '15min': 15,
            '30min': 30,
            '1h': 60,
            '2h': 120,
            '4h': 240,
            '1d': 1440,
            // Numeric-string format used by StreamsService internals
            '1': 1,
            '5': 5,
            '15': 15,
            '30': 30,
            '60': 60,
            '120': 120,
            '240': 240,
            '1440': 1440,
        };
        const krakenInterval = intervalMap[interval] || 1;

        try {
            const url = `${this.HistoryURL}?pair=${pair}&interval=${krakenInterval}`;
            const res = await fetch(url);
            const data = (await res.json()) as KrakenOHLCResponse;

            if (data.error && data.error.length > 0) {
                throw new Error(`Erreur API Kraken: ${data.error.join(', ')}`);
            }

            if (data.result) {
                const key = Object.keys(data.result).find((k) => k !== 'last');
                if (!key) return [];

                const ohlcRaw = data.result[key];

                if (Array.isArray(ohlcRaw) && ohlcRaw.length > 0) {
                    const ohlc = ohlcRaw as KrakenOHLCEntry[];

                    this.logger.debug(
                        `✅ Historique Kraken ${symbol} ${interval}: ${ohlc.length} bougies reçues.`,
                    );

                    const candles = ohlc.slice(-outputsize).map((k) => ({
                        time: k[0] * 1000, // Conversion Secondes -> Millisecondes
                        open: parseFloat(k[1]), // Précision absolue conservée
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        volume: parseFloat(k[6]), // k[6] est bien le volume, k[5] est le vwap
                    }));

                    this.CacheHistory.set(cacheKey, {
                        data: candles,
                        timestamp: now,
                    });

                    return candles;
                }
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(
                `Échec de l'historique Kraken pour ${symbol}: ${msg}`,
            );
        }

        return [];
    }

    private getSymbol(symbol: MarketPair): string | null {
        const s = this.SYMBOLS[symbol];
        if (!s) {
            this.logger.warn(
                `Symbole non trouvé dans le dictionnaire: ${symbol}`,
            );
            return null;
        }
        return s;
    }
}
