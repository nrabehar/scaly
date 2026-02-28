import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PricesService } from '../prices/prices.service';
import { SimulationService } from '../prices/simulation.service';
import { OrderbookService } from '../orderbook/orderbook.service';
import { NewsService } from '../news/news.service';
import { ScalpService } from '../signals/scalp.service';

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
];

@Controller('api')
export class ApiController {
  constructor(
    private prices: PricesService,
    private simulation: SimulationService,
    private orderbookService: OrderbookService,
    private newsService: NewsService,
    private scalpService: ScalpService,
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
      if (data) return { success: true, source: 'provider', symbol, data };
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
    const list = await this.newsService.fetchFeeds((symbol as any) || 'GLOBAL');
    return { success: true, items: list };
  }

  @Get('multi-tf')
  async multiTf(@Query('symbol') symbol = 'XAU/USD') {
    const intervals = ['1min', '5min', '15min', '1h'];
    const out: Record<string, any> = {};
    for (const iv of intervals) {
      try {
        const data = await this.prices.fetchHistory(symbol as any, iv, 200);
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
        const data = await this.prices.fetchHistory(symbol as any, '1min', 200);
        candles = data as any[];
      } catch {
        candles = this.simulation.getHistory(symbol);
      }
    }
    const result = this.scalpService.predict(symbol, candles);
    return { success: true, symbol, ...result };
  }
}
