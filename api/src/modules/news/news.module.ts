import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NewsClassifier } from './news.classifier';
import { NewsTasks } from './news.tasks';
import { NewsAggregator } from './news.aggregator';
import { ImpactAnalyzer } from './news.impact-analyser';
import { WsModule } from '../../ws/ws.module';
import { PrismaModule } from '../../persistence/prisma.module';

@Module({
    imports: [HttpModule, WsModule, PrismaModule],
    providers: [NewsClassifier, NewsAggregator, NewsTasks, ImpactAnalyzer],
    exports: [NewsClassifier, ImpactAnalyzer],
})
export class NewsModule {}
