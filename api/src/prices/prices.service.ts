import { Injectable } from '@nestjs/common';
import { KrakenApi } from './kraken.api';
import type { MarketPair } from './prices.api.types';
import { TradingViewApi } from './tradingview.api';
import {
  YahooFinanceApi,
  YahooInterval,
  YahooRange,
} from './yahoo-finance.api';

@Injectable()
export class PricesService {
  constructor(
    private readonly kraken: KrakenApi,
    private readonly tradingView: TradingViewApi,
    private readonly yahooFinance: YahooFinanceApi,
  ) {}

  async fetchTick(symbol: MarketPair, api?: string) {
    return await this.kraken.fetchTick(symbol);
  }

  async auxTick() {
    return await this.tradingView.fetchTick();
  }

  async fetchHistory(
    symbol: MarketPair,
    interval: string,
    outputsize: number,
    api?: string,
  ) {
    return await this.kraken.fetchHistory(symbol, interval, outputsize);
  }

  async fetchYahooHistory(
    symbol: string,
    interval: YahooInterval,
    range: YahooRange,
  ) {
    return await this.yahooFinance.fetchHistory(symbol, interval, range);
  }
}
