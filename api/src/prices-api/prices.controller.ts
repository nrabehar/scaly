import { Controller, Get, Query } from '@nestjs/common';
import { PricesService } from './prices.service';
import { MarketPair } from './prices.api.types';

@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  async fetchTick(@Query('pair') pair: string) {
    return await this.pricesService.fetchTick(pair as MarketPair);
  }

  @Get('history')
  async fetchHistory(@Query('pair') pair: string) {
    return await this.pricesService.fetchHistory(pair as MarketPair);
  }
}
