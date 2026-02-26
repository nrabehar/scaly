import { Module } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { WsModule } from '../ws/ws.module';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [WsModule, PricesModule],
  providers: [StreamsService],
  exports: [StreamsService],
})
export class StreamsModule {}
