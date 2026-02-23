import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  Candle,
  CandleHistory,
  IPriceAPI,
  MarketPair,
} from './prices.api.types';
import fetch from 'node-fetch';

@Injectable()
export class KrakenApi implements IPriceAPI {
  readonly SYMBOLS: Record<MarketPair, string> = {
    'XAU/USD': 'XAUTUSD',
    'BTC/USD': 'XXBTZUSD',
    'ETH/USD': 'XETHZUSD',
  };
  private readonly CacheMS = 15000;
  private CacheHistory: Map<string, CandleHistory> = new Map();
  private readonly TickURL = `https://api.kraken.com/0/public/Ticker`;
  private readonly HistoryURL = `https://api.kraken.com/0/public/OHLC`;

  private readonly logger = new Logger(KrakenApi.name);

  async fetchTick(symbol: MarketPair) {
    const pair = this.getSymbol(symbol);
    if (!pair) {
      throw new BadRequestException(`Bar symbol pair ${symbol}`);
    }
    try {
      const url = `${this.TickURL}?pair=${pair}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.result) {
        const key = Object.keys(data.result)[0];
        const tick = data.result[key];
        const bid = parseFloat(tick.b[0]);
        const ask = parseFloat(tick.a[0]);
        const price = (bid + ask) / 2;
        this.logger.log(
          `✅ Kraken tick ${symbol}: $${price.toFixed(2)}`,
          data.result,
        );
        return {
          price,
          bid,
          ask,
          spread: parseFloat((ask - bid).toFixed(2)),
          volume: parseFloat(tick.v[1]),
          timestamp: Date.now(),
        };
      }
    } catch (e) {
      this.logger.error(`Kraken tick ${symbol} failed:`, e.message);
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
      throw new BadRequestException(`Bar symbol pair ${symbol}`);
    }

    const cacheKey = `kraken:${symbol}:${interval}`;
    const inCache = this.CacheHistory.get(cacheKey);
    const now = Date.now();
    if (inCache && now - inCache.timestamp < this.CacheMS) {
      return inCache.data;
    }
    const intervalMap = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
      '1h': 60,
      '4h': 240,
    };
    const krakenInterval: number = intervalMap[interval] || 1;
    try {
      const url = `${this.HistoryURL}?pair=${pair}&interval=${krakenInterval}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (data.result) {
        const key = Object.keys(data.result).find((k) => k !== 'last');
        if (!key) return [];
        const ohlc = data.result[key];
        if (ohlc && ohlc.length > 0) {
          const candles = ohlc.slice(-outputsize).map((k) => ({
            time: parseInt(k[0]),
            open: parseFloat(parseFloat(k[1]).toFixed(2)),
            high: parseFloat(parseFloat(k[2]).toFixed(2)),
            low: parseFloat(parseFloat(k[3]).toFixed(2)),
            close: parseFloat(parseFloat(k[4]).toFixed(2)),
            volume: parseFloat(k[6]),
          }));
          this.CacheHistory.set(cacheKey, {
            data: candles,
            timestamp: now,
          });
          return candles;
        }
      }
    } catch (e) {}

    return [];
  }

  private getSymbol(symbol: MarketPair) {
    console.log('received symbol', symbol);
    const s = this.SYMBOLS[symbol];
    if (!s) {
      return null;
    }
    return s;
  }
}
