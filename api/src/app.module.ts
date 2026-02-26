import { Module } from '@nestjs/common';
import { PricesModule } from './prices/prices.module';
import { AgentsModule } from './agents/agents.module';
import { ConfigModule } from '@nestjs/config';
import {
    agentConfig,
    appConfig,
    authConfig,
    databaseConfig,
    mailConfig,
} from './core/config';
import { NewsModule } from './news/news.module';
import { HttpModule } from '@nestjs/axios';
import { SignalsModule } from './signals/signals.module';
import { AiModule } from './ai/ai.module';
import { PrismaService } from './persistence/prisma.service';
import { ScheduleModule } from '@nestjs/schedule';
import { WsModule } from './ws/ws.module';
import { StreamsModule } from './streams/streams.module';
import { ApiController } from './api/api.controller';
import { AccessService } from './access/access.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, mailConfig, agentConfig],
    }),
    HttpModule.register({
      timeout: 5000,
    }),
    PricesModule,
    AgentsModule,
    NewsModule,
    SignalsModule,
    AiModule,
    WsModule,
    StreamsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [ApiController],
  providers: [PrismaService, AccessService],
})
export class AppModule {}
