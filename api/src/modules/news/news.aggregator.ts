import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import RssParser from 'rss-parser';
import * as crypto from 'crypto';
import { NewsAsset, INew } from './news.types';
import { ConfigService } from '@nestjs/config';
import { RSS_SOURCES } from './constants/rss.source';

function getErrorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

// ─── Internal API response shapes ────────────────────────────────────────────
interface CryptoPanicPost {
    id: number;
    title: string;
    url: string;
    published_at: string;
    currencies?: { code: string }[];
    votes?: { important: number };
}

interface FinnhubArticle {
    id: number;
    headline: string;
    summary: string;
    url: string;
    datetime: number;
}

@Injectable()
export class NewsAggregator {
    private readonly logger = new Logger(NewsAggregator.name);
    private readonly rssParser = new RssParser({ timeout: 10_000 });
    private readonly cryptopanicApiKey: string;
    private readonly finnhubApiKey: string | undefined;

    constructor(
        private readonly config: ConfigService,
        private readonly http: HttpService,
    ) {
        this.cryptopanicApiKey =
            this.config.get<string>('news.cryptopanicApiKey') ?? '';
        this.finnhubApiKey = this.config.get<string>('news.finnhubApiKey');
    }

    async fetchAll(): Promise<INew[]> {
        this.logger.log('Starting global news fetch...');

        const results = await Promise.allSettled([
            ...RSS_SOURCES.map((s) => this.fetchRSS(s.url, s.asset, s.name)),
            this.fetchCryptoPanic(),
            this.fetchFinnhub(),
        ]);

        const allNews = results
            .filter(
                (res): res is PromiseFulfilledResult<INew[]> =>
                    res.status === 'fulfilled',
            )
            .flatMap((res) => res.value);

        return this.deduplicate(allNews);
    }

    private async fetchRSS(
        url: string,
        asset: NewsAsset,
        sourceName: string,
    ): Promise<INew[]> {
        try {
            const feed = await this.rssParser.parseURL(url);
            return feed.items.map((item) => ({
                id: this.generateId(item.title || item.link || ''),
                title: item.title || '',
                description: item.contentSnippet || '',
                url: item.link || '',
                timestamp: new Date(item.pubDate || Date.now()),
                source: sourceName,
                asset,
            }));
        } catch (e) {
            this.logger.error(
                `Error fetching RSS from ${sourceName}: ${getErrorMessage(e)}`,
            );
            return [];
        }
    }

    private async fetchCryptoPanic(): Promise<INew[]> {
        if (!this.cryptopanicApiKey) {
            this.logger.warn(
                'CRYPTOPANIC_API_KEY not set — skipping CryptoPanic fetch',
            );
            return [];
        }
        try {
            const res = await lastValueFrom(
                this.http.get<{ results: CryptoPanicPost[] }>(
                    `https://cryptopanic.com/api/developer/v2/posts/?auth_token=${this.cryptopanicApiKey}`,
                    { timeout: 10_000 },
                ),
            );
            return res.data.results.map((post) => ({
                id: this.generateId(`cp-${post.id}`),
                title: post.title,
                description: '',
                url: post.url,
                timestamp: new Date(post.published_at),
                source: 'CryptoPanic',
                asset: this.resolveCryptoPanicAsset(post.currencies),
            }));
        } catch (e) {
            this.logger.error(
                `Failed CryptoPanic fetch: ${getErrorMessage(e)}`,
            );
            return [];
        }
    }

    private async fetchFinnhub(): Promise<INew[]> {
        if (!this.finnhubApiKey) {
            this.logger.warn(
                'FINNHUB_API_KEY not set — skipping Finnhub fetch',
            );
            return [];
        }
        try {
            const res = await lastValueFrom(
                this.http.get<FinnhubArticle[]>(
                    `https://finnhub.io/api/v1/news?category=forex&token=${this.finnhubApiKey}`,
                    { timeout: 10_000 },
                ),
            );
            return res.data.map((item) => ({
                id: this.generateId(`finnhub-${item.id}`),
                title: item.headline,
                description: item.summary || '',
                url: item.url,
                timestamp: new Date(item.datetime * 1000),
                source: 'Finnhub',
                asset: 'MACRO' as NewsAsset,
            }));
        } catch (e) {
            this.logger.error(`Failed Finnhub fetch: ${getErrorMessage(e)}`);
            return [];
        }
    }

    private resolveCryptoPanicAsset(
        currencies?: { code: string }[],
    ): NewsAsset {
        if (!currencies?.length) return 'MACRO';
        if (currencies.some((c) => c.code === 'BTC')) return 'BTC';
        if (currencies.some((c) => c.code === 'ETH')) return 'ETH';
        if (currencies.some((c) => c.code === 'OIL')) return 'OIL';
        if (currencies.some((c) => c.code === 'EQUITIES')) return 'EQUITIES';
        if (currencies.some((c) => c.code === 'FOREX')) return 'FOREX';
        return 'MACRO';
    }

    private generateId(input: string): string {
        return crypto.createHash('md5').update(input).digest('hex');
    }

    private deduplicate(news: INew[]): INew[] {
        const seen = new Set<string>();
        return news.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
    }
}
