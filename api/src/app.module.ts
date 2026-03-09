import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
    agentConfig,
    appConfig,
    authConfig,
    databaseConfig,
    mailConfig,
    newsConfig,
} from './core/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { NewsModule } from './modules/news/news.module';
import { WsModule } from './ws/ws.module';
import { PrismaModule } from './persistence/prisma.module';
import { PricesModule } from './prices/prices.module';
import { SignalsModule } from './signals/signals.module';
import { StreamsModule } from './streams/streams.module';
import { ApiModule } from './api/api.module';
import { AiModule } from './ai/ai.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [
                appConfig,
                authConfig,
                databaseConfig,
                mailConfig,
                agentConfig,
                newsConfig,
            ],
        }),
        HttpModule.register({
            timeout: 5000,
        }),
        ScheduleModule.forRoot(),
        PrismaModule,
        WsModule,
        NewsModule,
        PricesModule,
        SignalsModule,
        StreamsModule,
        ApiModule,
        AiModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
