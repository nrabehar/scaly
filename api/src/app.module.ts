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
  ],
})
export class AppModule {}
