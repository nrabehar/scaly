import { MarketPair } from 'src/prices/prices.api.types';
import { decodeXmlValue, extractXmlTag } from './xml';
import { NewsImpactLevel } from '../news.sentiment';

export interface RSSFeed {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

export interface IRSSFeed {
  url: string;
  title: string;
  link: string;
  author: string;
  description: string;
  image: string;
}

export interface IRSSFeedItem {
  title: string;
  pubDate: string;
  link: string;
  guid?: string;
  author?: string;
  thumbnail?: string;
  description: string;
  content?: string;
  source?: string;
  enclosure?: object;
  categories?: string[];
}

export interface RSSFeedResponse {
  status: string;
  feed: IRSSFeed;
  items: IRSSFeedItem[];
}

export const parseRSSFeedXml = (
  xmlText: string,
  defaultSource: string = 'News',
): RSSFeed[] => {
  const xml = String(xmlText || '');
  if (!xml) return [];

  const channelBlock = (xml.match(/<channel[\s\S]*?<\/channel>/i) || [xml])[0];
  const channelTitle = extractXmlTag(channelBlock, 'title') || defaultSource;

  let itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  let isAtom = false;
  if (itemBlocks.length === 0) {
    itemBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
    isAtom = itemBlocks.length > 0;
  }

  const nowIso = new Date().toISOString();
  return itemBlocks
    .map((block) => {
      const title = extractXmlTag(block, 'title');
      const description =
        extractXmlTag(block, 'description') ||
        extractXmlTag(block, 'summary') ||
        extractXmlTag(block, 'content');
      const pubDate =
        extractXmlTag(block, 'pubDate') ||
        extractXmlTag(block, 'updated') ||
        extractXmlTag(block, 'published') ||
        nowIso;

      let link = extractXmlTag(block, 'link');
      if (isAtom && !link) {
        const hrefMatch = block.match(
          /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i,
        );
        link = hrefMatch ? decodeXmlValue(hrefMatch[1]) : '';
      }

      return {
        title,
        link,
        pubDate,
        description,
        source: channelTitle,
      };
    })
    .filter((item) => item.title);
};

export const isNewsRelevantForSymbol = (
  symbol: MarketPair,
  titleLower: string,
  impact: NewsImpactLevel,
) => {
  const isXauRelevant =
    titleLower.includes('gold') ||
    titleLower.includes('precious') ||
    titleLower.includes('xau') ||
    titleLower.includes('fed') ||
    titleLower.includes('inflation') ||
    titleLower.includes('dollar');
  const isBtcRelevant =
    titleLower.includes('bitcoin') ||
    titleLower.includes('btc') ||
    titleLower.includes('crypto') ||
    titleLower.includes('blockchain');
  const isEthRelevant =
    titleLower.includes('ethereum') ||
    titleLower.includes('eth') ||
    titleLower.includes('crypto') ||
    titleLower.includes('defi');
  const isMacroRelevant =
    titleLower.includes('market') ||
    titleLower.includes('economy') ||
    titleLower.includes('trade');

  if (symbol === 'XAU/USD')
    return isXauRelevant || isMacroRelevant || impact === 'HIGH';
  if (symbol === 'BTC/USD')
    return isBtcRelevant || isMacroRelevant || impact === 'HIGH';
  if (symbol === 'ETH/USD')
    return isEthRelevant || isMacroRelevant || impact === 'HIGH';
  return isMacroRelevant || impact === 'HIGH';
};
