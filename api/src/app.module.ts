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
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
