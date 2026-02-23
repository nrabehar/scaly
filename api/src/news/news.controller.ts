import { Controller, Get, Query } from '@nestjs/common';
import { NewsService } from './news.service';
import type { MarketPair } from 'src/prices-api/prices.api.types';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async fetch(@Query('pair') pair: MarketPair) {
    const symbol: MarketPair = pair ? pair : 'XAU/USD';
    return await this.newsService.fetchFeeds(symbol);
  }
}
