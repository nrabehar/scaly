import { Module } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { WsModule } from '../ws/ws.module';
import { PricesModule } from '../prices/prices.module';
import { NewsModule } from '../news/news.module';
import { HttpModule } from '@nestjs/axios';
import { OrderbookService } from '../orderbook/orderbook.service';

@Module({
  imports: [WsModule, PricesModule, NewsModule, HttpModule],
  providers: [StreamsService, OrderbookService],
  exports: [StreamsService],
})
export class StreamsModule {}
