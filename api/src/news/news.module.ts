import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { NewsRss } from './news.rss';

@Module({
  controllers: [NewsController],
  providers: [NewsService, NewsRss],
  exports: [NewsService],
})
export class NewsModule {}
