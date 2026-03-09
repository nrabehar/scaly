import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NewsAggregator } from './news.aggregator';
import { NewsClassifier } from './news.classifier';
import { ImpactAnalyzer } from './news.impact-analyser';
import { ImpactLevel } from './constants/impact';
import { INew, INewClassificationResult } from './news.types';
import { WsGateway } from '../../ws/ws.gateway';
import { PrismaService } from '../../persistence/prisma.service';

/** Retention window for processed news deduplication entries (default: 30 days). */
const PROCESSED_NEWS_RETENTION_DAYS = 5;

@Injectable()
export class NewsTasks {
    private readonly logger = new Logger(NewsTasks.name);

    constructor(
        private readonly aggregator: NewsAggregator,
        private readonly impactAnalyzer: ImpactAnalyzer,
        private readonly classifier: NewsClassifier,
        private readonly wsGateway: WsGateway,
        private readonly prisma: PrismaService,
    ) {}

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleNewsUpdate() {
        const newsList = await this.aggregator.fetchAll();
        this.logger.log(`Fetched ${newsList.length} news items. Analyzing...`);

        // Cross-run deduplication: filter articles already processed in a prior tick
        const incomingIds = newsList.map((n) => n.id);
        const alreadySeen = await this.prisma.processedNews.findMany({
            where: { id: { in: incomingIds } },
            select: { id: true },
        });
        const seenSet = new Set(alreadySeen.map((r) => r.id));
        const freshNews = newsList.filter((n) => !seenSet.has(n.id));

        this.logger.log(
            `${freshNews.length} new items after cross-run deduplication.`,
        );

        for (const news of freshNews) {
            const impact = this.impactAnalyzer.analyze(
                news.title,
                news.description,
            );

            const analysis = this.classifier.classify(news.title);

            await this.prisma.processedNews.create({
                data: {
                    id: news.id,
                    title: news.title,
                    source: news.source,
                    url: news.url,
                    asset: news.asset,
                    impact: ImpactLevel[impact],
                    label: analysis.label,
                    confidence: analysis.confidence,
                    processedAt: new Date(),
                },
            });

            if (impact <= ImpactLevel.MEDIUM) continue;

            // Tiered confidence threshold: CRITICAL items are broadcast with a lower
            // bar (>= 30%) since their macro importance is high; HIGH items require
            // strong classifier certainty (>= 70%).
            const confidenceThreshold =
                impact === ImpactLevel.CRITICAL ? 0.3 : 0.7;
            if (analysis.confidence >= confidenceThreshold) {
                await this.broadcastSignal(news, impact, analysis);
            }
        }
    }

    private async broadcastSignal(
        news: INew,
        impact: ImpactLevel,
        analysis: INewClassificationResult,
    ): Promise<void> {
        const direction = analysis.label.includes('BULLISH')
            ? 'BULLISH'
            : 'BEARISH';
        const payload = {
            asset: news.asset,
            impact: ImpactLevel[impact],
            direction,
            label: analysis.label,
            confidence: parseFloat((analysis.confidence * 100).toFixed(2)),
            title: news.title,
            source: news.source,
            url: news.url,
            timestamp: news.timestamp,
        };

        this.wsGateway.broadcastNews(news.asset, payload);
    }

    /**
     * Weekly cleanup — runs every Sunday at 02:00.
     * Deletes ProcessedNews entries older than PROCESSED_NEWS_RETENTION_DAYS
     * and Signal entries older than SIGNAL_RETENTION_DAYS.
     * This keeps the deduplication table lean without losing recent history.
     */
    @Cron('0 2 * * 0')
    async handleWeeklyCleanup() {
        const now = new Date();

        const newsThreshold = new Date(now);
        newsThreshold.setDate(
            newsThreshold.getDate() - PROCESSED_NEWS_RETENTION_DAYS,
        );

        const [deletedNews] = await Promise.all([
            this.prisma.processedNews.deleteMany({
                where: { processedAt: { lt: newsThreshold } },
            }),
        ]);

        this.logger.log(
            `[Cleanup] Deleted ${deletedNews.count} processed news entries ` +
                `older than ${PROCESSED_NEWS_RETENTION_DAYS} days.`,
        );
    }
}
