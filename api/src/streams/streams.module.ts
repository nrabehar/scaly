import { Module } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { WsModule } from '../ws/ws.module';
import { PricesModule } from '../prices/prices.module';
import { SignalsModule } from '../signals/signals.module';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [WsModule, PricesModule, SignalsModule, AiModule],
    providers: [StreamsService],
    exports: [StreamsService],
})
export class StreamsModule {}
