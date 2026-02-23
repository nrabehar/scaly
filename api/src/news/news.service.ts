import { Injectable, Logger } from '@nestjs/common';
import { NewsRss, NewsItem } from './news.rss';
import { MarketPair } from 'src/prices-api/prices.api.types';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  constructor(private readonly newsRss: NewsRss) {}

  async fetchFeeds(symbol: MarketPair): Promise<NewsItem[]> {
    try {
      return await this.newsRss.fetch(symbol);
    } catch (err) {
      this.logger.error('NewsService.fetchFeeds error:', err?.message ?? err);
      return [];
    }
  }
}
