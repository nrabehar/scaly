import nodeFetch from 'node-fetch';
import { Injectable } from '@nestjs/common';

import { RSS_FEEDS } from './news.constant';
import { analyzeSentiment, NewsImpactLevel } from './news.sentiment';
import { MarketPair } from 'src/prices-api/prices.api.types';
import type { IRSSFeedItem, RSSFeedResponse } from './utils/rss';
import { isNewsRelevantForSymbol } from './utils/rss';

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: string;
  sentimentScore: number;
  impact: NewsImpactLevel;
  relevant: boolean;
};

@Injectable()
export class NewsRss {
  private static readonly API_URL = 'https://api.rss2json.com/v1/api.json';

  private allItems: NewsItem[] = [];
  private seenLinks: Set<string> = new Set();

  async fetch(symbol: MarketPair) {
    // Reset state for each fetch so results don't accumulate across calls
    this.resetState();

    const key = RSS_FEEDS[symbol] ? symbol : 'GLOBAL';
    const feedUrls = RSS_FEEDS[key] || [];

    if (feedUrls.length === 0) return [];

    for (const feedUrl of feedUrls) {
      try {
        const url = this.buildApiUrl(feedUrl);
        const res = await nodeFetch(url);
        const data = (await res.json()) as RSSFeedResponse;

        if (data?.status === 'ok' && Array.isArray(data.items)) {
          for (const item of data.items) {
            this.pushItem(
              {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description || '',
                source: data.feed?.title || 'News',
              },
              symbol,
              data.feed?.title || 'News',
            );
          }
        } else if (data?.status && data.status !== 'ok') {
          console.warn(`rss2json returned ${data.status} for ${feedUrl}`);
        }
      } catch (err) {
        console.error(
          `Failed to fetch RSS for ${feedUrl}:`,
          err?.message ?? err,
        );
      }
    }

    this.sortAllItems();

    return this.allItems.slice(0, 15);
  }

  private resetState() {
    this.allItems = [];
    this.seenLinks.clear();
  }

  private buildApiUrl(feedUrl: string) {
    return `${NewsRss.API_URL}?rss_url=${encodeURIComponent(feedUrl)}&count=10`;
  }

  private sortAllItems() {
    this.allItems.sort((a, b) => {
      if (a.relevant !== b.relevant) return b.relevant ? 1 : -1;
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });
  }

  private pushItem(
    item: IRSSFeedItem,
    symbol: MarketPair,
    fallbackSource = 'News',
  ) {
    const title = String(item?.title || '').trim();
    if (!title) return 0;

    const link =
      String(item?.link || '').trim() ||
      `${fallbackSource}-${title.slice(0, 24)}`;
    if (this.seenLinks.has(link)) return 0;

    const description = String(item?.description || item?.content || '');
    const sentiment = analyzeSentiment(title, description);
    const titleLower = title.toLowerCase();
    const isRelevant = isNewsRelevantForSymbol(
      symbol,
      titleLower,
      sentiment.impact,
    );

    if (!isRelevant && this.allItems.length >= 5) return 0;

    this.seenLinks.add(link);
    this.allItems.push({
      title,
      link,
      pubDate: item?.pubDate || new Date().toISOString(),
      source: item?.source || fallbackSource,
      sentiment: sentiment.sentiment,
      sentimentScore: sentiment.score,
      impact: sentiment.impact,
      relevant: isRelevant,
    });
    return 1;
  }
}
