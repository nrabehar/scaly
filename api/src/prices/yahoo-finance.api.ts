import { Injectable } from '@nestjs/common';
import yahooFinance from 'yahoo-finance2';

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
  | '1o'
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
export const YAHOO_FINANCE_RANGES: Record<YahooRange, Date> = {
  '1d': new Date(Date.now() - 24 * 60 * 60 * 1000),
  '5d': new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  '1mo': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  '3mo': new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  '6mo': new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
  '1y': new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  '2y': new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
  '5y': new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
  '1o': new Date(Date.now() - 365 * 7 * 24 * 60 * 60 * 1000),
  ytd: new Date(new Date().getFullYear(), 1, 1),
  max: new Date(1978, 1, 1),
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
  '1mo': '1o',
  '3mo': 'max',
};

@Injectable()
export class YahooFinanceApi {
  private readonly CacheMS = 1500;
  private CacheHistory: Map<string, { timestamp: number; data: unknown }> =
    new Map();
  private YahooFinance = new yahooFinance();

  async fetchHistory(
    symbol: string = 'GC=F',
    interval: YahooInterval = '1h',
    range: YahooRange = '1y',
  ): Promise<unknown | null> {
    const cacheKey = `${symbol}_${interval}_${range}`;
    const cached = this.CacheHistory.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CacheMS) {
      return cached.data;
    }

    const endDate = new Date();
    const maxDate =
      YAHOO_FINANCE_RANGES[
        YAHOO_FINANCE_INTERVAL_MAX_RANGE_REQUEST[interval]
      ] || YAHOO_FINANCE_RANGES[range];

    try {
      const raw = await this.YahooFinance.chart(symbol, {
        interval,
        period1: maxDate,
        period2: endDate,
      });
      const data = raw.quotes
        .filter((q) => q.close !== null)
        .map((q) => ({
          time: q.date.getTime(),
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume || 0,
        }));
      data.sort((a, b) => a.time - b.time);
      this.CacheHistory.set(cacheKey, { timestamp: Date.now(), data });
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
    }
    return null;
  }
}
