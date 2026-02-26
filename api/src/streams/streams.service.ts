import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { WsGateway } from '../ws/ws.gateway';
import { PricesService } from '../prices/prices.service';
import { SimulationService } from '../prices/simulation.service';

@Injectable()
export class StreamsService {
  private readonly logger = new Logger(StreamsService.name);

  constructor(
    private readonly ws: WsGateway,
    private readonly prices: PricesService,
    private readonly simulation: SimulationService,
  ) {}

  @Interval(2000)
  async streamPrices() {
    try {
      // stream instrument list from simulation
      for (const symbol of ['BTC/USD', 'ETH/USD', 'XAU/USD']) {
        let tick: any = null;
        try {
          tick = await this.prices.fetchTick(symbol as any);
        } catch (e) {
          // fallback to simulation
        }
        if (!tick) {
          const c = this.simulation.addSimulatedCandle(symbol);
          tick = {
            price: c.close,
            bid: c.close * 0.9999,
            ask: c.close * 1.0001,
            timestamp: Date.now(),
            source: 'simulated',
          };
        }
        this.ws.broadcastPrice(symbol, tick);
      }
    } catch (e) {
      this.logger.error('streamPrices error', e as any);
    }
  }

  @Interval(5000)
  async streamOrderbook() {
    try {
      // emit a simple placeholder orderbook using last price
      for (const symbol of ['BTC/USD', 'ETH/USD']) {
        const last = this.simulation.getLastPrice(symbol) || { price: 0 };
        const ob = {
          bids: [[last.price * 0.999, 1]],
          asks: [[last.price * 1.001, 1]],
          ts: Date.now(),
        };
        this.ws.broadcastOrderbook(symbol, ob);
      }
    } catch (e) {
      this.logger.error('streamOrderbook error', e as any);
    }
  }

  @Interval(60000)
  async streamNews() {
    try {
      // placeholder news broadcast
      const item = {
        title: 'No news',
        summary: 'No new items',
        ts: Date.now(),
      };
      this.ws.broadcastNews('GLOBAL', item);
    } catch (e) {
      this.logger.error('streamNews error', e as any);
    }
  }
}
