import { Module } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { WsModule } from '../ws/ws.module';
import { PricesModule } from '../prices/prices.module';
import { HttpModule } from '@nestjs/axios';
import { OrderbookService } from '../orderbook/orderbook.service';

@Module({
    imports: [WsModule, PricesModule, HttpModule],
    providers: [StreamsService, OrderbookService],
    exports: [StreamsService],
})
export class StreamsModule {}
