import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const BINANCE_MAP: Record<string, string> = {
  'BTC/USD': 'BTCUSDT',
  'ETH/USD': 'ETHUSDT',
};

@Injectable()
export class OrderbookService {
  constructor(private readonly http: HttpService) {}

  async fetchOrderbook(symbol: string) {
    const pair = BINANCE_MAP[symbol];
    if (!pair) return null;
    const url = `https://api.binance.com/api/v3/depth?symbol=${pair}&limit=5`;
    try {
      const res = await firstValueFrom(this.http.get(url));
      const data = res.data;
      return {
        symbol,
        bids: data.bids?.slice(0, 10) || [],
        asks: data.asks?.slice(0, 10) || [],
        timestamp: Date.now(),
        source: 'binance',
      };
    } catch (e) {
      return null;
    }
  }
}
