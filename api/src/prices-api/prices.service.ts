import { Injectable } from '@nestjs/common';
import { KrakenApi } from './kraken.api';
import type { MarketPair } from './prices.api.types';

@Injectable()
export class PricesService {
  constructor(private readonly kraken: KrakenApi) {}

  async fetchTick(symbol: MarketPair, api?: string) {
    return await this.kraken.fetchTick(symbol);
  }

  async fetchHistory(symbol: MarketPair, api?: string) {
    return await this.kraken.fetchHistory(symbol);
  }
}
