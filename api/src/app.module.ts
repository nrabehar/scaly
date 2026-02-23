import { Module } from '@nestjs/common';
import { PricesModule } from './prices-api/prices.module';
import { AgentsModule } from './agents/agents.module';
import { ConfigModule } from '@nestjs/config';
import {
  agentConfig,
  appConfig,
  authConfig,
  databaseConfig,
  mailConfig,
} from './core/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, mailConfig, agentConfig],
    }),
    PricesModule,
    AgentsModule,
  ],
})
export class AppModule {}
