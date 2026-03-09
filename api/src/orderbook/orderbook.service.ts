import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const BINANCE_MAP: Record<string, string> = {
    'BTC/USD': 'BTCUSDT',
    'ETH/USD': 'ETHUSDT',
};

/** Kraken pair names for the /public/Depth endpoint */
const KRAKEN_MAP: Record<string, string> = {
    'BTC/USD': 'XBTUSD',
    'ETH/USD': 'ETHUSD',
    'XAU/USD': 'XAUUSD',
};

interface KrakenDepthResponse {
    error: string[];
    result?: Record<
        string,
        { asks: [string, string, number][]; bids: [string, string, number][] }
    >;
}

@Injectable()
export class OrderbookService {
    private readonly logger = new Logger(OrderbookService.name);
    constructor(private readonly http: HttpService) {}

    async fetchOrderbook(symbol: string) {
        // Try Binance first (lowest latency for crypto)
        const binancePair = BINANCE_MAP[symbol];
        if (binancePair) {
            try {
                const url = `https://api.binance.com/api/v3/depth?symbol=${binancePair}&limit=10`;
                const res = await firstValueFrom(
                    this.http.get<{ bids: string[][]; asks: string[][] }>(url),
                );
                return {
                    symbol,
                    bids: res.data.bids?.slice(0, 10) ?? [],
                    asks: res.data.asks?.slice(0, 10) ?? [],
                    timestamp: Date.now(),
                    source: 'binance',
                };
            } catch (e: unknown) {
                this.logger.warn(
                    `fetchOrderbook Binance(${symbol}) failed, trying Kraken: ${e instanceof Error ? e.message : String(e)}`,
                );
            }
        }

        // Fallback: Kraken
        const krakenPair = KRAKEN_MAP[symbol];
        if (!krakenPair) return null;
        try {
            const url = `https://api.kraken.com/0/public/Depth?pair=${krakenPair}&count=10`;
            const res = await firstValueFrom(
                this.http.get<KrakenDepthResponse>(url),
            );
            const data = res.data;
            if (data.error?.length) {
                this.logger.error(
                    `Kraken orderbook error for ${symbol}: ${data.error.join(', ')}`,
                );
                return null;
            }
            const book = data.result ? Object.values(data.result)[0] : null;
            if (!book) return null;
            return {
                symbol,
                bids: book.bids.slice(0, 10).map(([p, v]) => [p, v]),
                asks: book.asks.slice(0, 10).map(([p, v]) => [p, v]),
                timestamp: Date.now(),
                source: 'kraken',
            };
        } catch (e: unknown) {
            this.logger.error(
                `fetchOrderbook Kraken(${symbol}) failed: ${e instanceof Error ? e.message : String(e)}`,
            );
            return null;
        }
    }
}
