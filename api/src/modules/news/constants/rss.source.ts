import type { NewsAsset } from '../news.types';

export const RSS_SOURCES = [
    // ═══════════════════════════════════════════════
    //  GOLD / PRECIOUS METALS — XAU
    // ═══════════════════════════════════════════════
    {
        url: 'https://news.kitco.com/rss/kitconewsfeed.xml',
        asset: 'XAU' as NewsAsset,
        name: 'Kitco News',
    },

    {
        url: 'https://www.investing.com/rss/news_285.rss',
        asset: 'XAU' as NewsAsset,
        name: 'Investing.com Gold',
    },
    {
        url: 'https://www.mining.com/feed/',
        asset: 'XAU' as NewsAsset,
        name: 'Mining.com',
    },

    {
        url: 'https://www.silverseek.com/rss.xml',
        asset: 'XAU' as NewsAsset,
        name: 'SilverSeek',
    },
    {
        url: 'https://www.resourceworld.com/feed/',
        asset: 'XAU' as NewsAsset,
        name: 'Resource World',
    },

    {
        url: 'https://finance.yahoo.com/rss/headline?s=GLD',
        asset: 'XAU' as NewsAsset,
        name: 'Yahoo Finance GLD',
    },
    {
        url: 'https://finance.yahoo.com/rss/headline?s=IAU',
        asset: 'XAU' as NewsAsset,
        name: 'Yahoo Finance IAU',
    },

    // ═══════════════════════════════════════════════
    //  CRYPTO — BTC / ETH
    // ═══════════════════════════════════════════════
    {
        url: 'https://cointelegraph.com/rss',
        asset: 'BTC' as NewsAsset,
        name: 'CoinTelegraph',
    },
    {
        url: 'https://coindesk.com/arc/outboundfeeds/rss/',
        asset: 'BTC' as NewsAsset,
        name: 'CoinDesk',
    },
    {
        url: 'https://decrypt.co/feed',
        asset: 'BTC' as NewsAsset,
        name: 'Decrypt',
    },
    {
        url: 'https://www.theblock.co/rss.xml',
        asset: 'BTC' as NewsAsset,
        name: 'The Block',
    },
    {
        url: 'https://blockworks.co/feed',
        asset: 'BTC' as NewsAsset,
        name: 'Blockworks',
    },
    {
        url: 'https://cryptobriefing.com/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'Crypto Briefing',
    },
    {
        url: 'https://ambcrypto.com/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'AMBCrypto',
    },
    {
        url: 'https://newsbtc.com/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'NewsBTC',
    },
    {
        url: 'https://beincrypto.com/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'BeInCrypto',
    },
    {
        url: 'https://u.today/rss',
        asset: 'BTC' as NewsAsset,
        name: 'U.Today',
    },
    {
        url: 'https://dailyhodl.com/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'The Daily Hodl',
    },
    {
        url: 'https://cryptopotato.com/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'CryptoPotato',
    },
    {
        url: 'https://bitcoinist.com/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'Bitcoinist',
    },
    {
        url: 'https://www.investing.com/rss/news_301.rss',
        asset: 'BTC' as NewsAsset,
        name: 'Investing.com Crypto',
    },
    {
        url: 'https://crypto.news/feed/',
        asset: 'BTC' as NewsAsset,
        name: 'Crypto.news',
    },

    {
        url: 'https://finance.yahoo.com/rss/headline?s=BTC-USD',
        asset: 'BTC' as NewsAsset,
        name: 'Yahoo Finance BTC',
    },
    {
        url: 'https://finance.yahoo.com/rss/headline?s=ETH-USD',
        asset: 'BTC' as NewsAsset,
        name: 'Yahoo Finance ETH',
    },
    {
        url: 'https://bitcoincore.org/en/rss.xml',
        asset: 'BTC' as NewsAsset,
        name: 'Bitcoin Core Dev',
    },

    // ═══════════════════════════════════════════════
    //  MACRO / GLOBAL ECONOMY
    // ═══════════════════════════════════════════════
    {
        url: 'https://www.investing.com/rss/news.rss',
        asset: 'MACRO' as NewsAsset,
        name: 'Investing.com Macro',
    },
    {
        url: 'https://feeds.bloomberg.com/markets/news.rss',
        asset: 'MACRO' as NewsAsset,
        name: 'Bloomberg Markets',
    },
    {
        url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'WSJ Markets',
    },
    {
        url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'WSJ Business',
    },
    {
        url: 'https://www.ft.com/?format=rss',
        asset: 'MACRO' as NewsAsset,
        name: 'Financial Times',
    },
    {
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'NYT Business',
    },
    {
        url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
        asset: 'MACRO' as NewsAsset,
        name: 'CNBC Economy',
    },
    {
        url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
        asset: 'MACRO' as NewsAsset,
        name: 'CNBC Finance',
    },
    {
        url: 'https://seekingalpha.com/feed.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'Seeking Alpha',
    },
    {
        url: 'https://wolfstreet.com/feed/',
        asset: 'MACRO' as NewsAsset,
        name: 'Wolf Street',
    },
    {
        url: 'https://www.project-syndicate.org/rss',
        asset: 'MACRO' as NewsAsset,
        name: 'Project Syndicate',
    },
    {
        url: 'https://www.federalreserve.gov/feeds/press_all.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'Federal Reserve Press',
    },
    {
        url: 'https://www.ecb.europa.eu/rss/press.html',
        asset: 'MACRO' as NewsAsset,
        name: 'ECB Press Releases',
    },
    {
        url: 'https://fortune.com/feed/',
        asset: 'MACRO' as NewsAsset,
        name: 'Fortune',
    },
    {
        url: 'https://www.economist.com/finance-and-economics/rss.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'The Economist Finance',
    },
    {
        url: 'https://foreignpolicy.com/feed/',
        asset: 'MACRO' as NewsAsset,
        name: 'Foreign Policy',
    },
    {
        url: 'https://www.forbes.com/business/feed/',
        asset: 'MACRO' as NewsAsset,
        name: 'Forbes Business',
    },
    {
        url: 'https://finance.yahoo.com/news/rssindex',
        asset: 'MACRO' as NewsAsset,
        name: 'Yahoo Finance News',
    },
    {
        url: 'https://www.marketwatch.com/rss/topstories',
        asset: 'MACRO' as NewsAsset,
        name: 'MarketWatch Top Stories',
    },
    {
        url: 'https://www.businessinsider.com/rss',
        asset: 'MACRO' as NewsAsset,
        name: 'Business Insider',
    },
    {
        url: 'https://mises.org/rss.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'Mises Institute',
    },
    {
        url: 'https://www.axios.com/feeds/feed.rss',
        asset: 'MACRO' as NewsAsset,
        name: 'Axios',
    },
    {
        url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
        asset: 'MACRO' as NewsAsset,
        name: 'BBC Business',
    },

    // ═══════════════════════════════════════════════
    //  OIL & ENERGY
    // ═══════════════════════════════════════════════
    {
        url: 'https://oilprice.com/rss/main',
        asset: 'OIL' as NewsAsset,
        name: 'OilPrice.com',
    },

    {
        url: 'https://www.investing.com/rss/news_25.rss',
        asset: 'OIL' as NewsAsset,
        name: 'Investing.com Oil',
    },
    {
        url: 'https://www.rigzone.com/news/rss/rigzone_latest.aspx',
        asset: 'OIL' as NewsAsset,
        name: 'Rigzone',
    },
    {
        url: 'https://www.energymonitor.ai/feed/',
        asset: 'OIL' as NewsAsset,
        name: 'Energy Monitor',
    },
    {
        url: 'https://finance.yahoo.com/rss/headline?s=CL%3DF',
        asset: 'OIL' as NewsAsset,
        name: 'Yahoo Finance WTI',
    },
    {
        url: 'https://finance.yahoo.com/rss/headline?s=BZ%3DF',
        asset: 'OIL' as NewsAsset,
        name: 'Yahoo Finance Brent',
    },
    {
        url: 'https://www.offshore-technology.com/feed/',
        asset: 'OIL' as NewsAsset,
        name: 'Offshore Technology',
    },
    {
        url: 'https://www.arabianbusiness.com/feed',
        asset: 'OIL' as NewsAsset,
        name: 'Arabian Business (OPEC)',
    },

    // ═══════════════════════════════════════════════
    //  EQUITIES / STOCKS
    // ═══════════════════════════════════════════════
    {
        url: 'https://www.marketwatch.com/rss/realtimeheadlines',
        asset: 'EQUITIES' as NewsAsset,
        name: 'MarketWatch Real-Time',
    },
    {
        url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html',
        asset: 'EQUITIES' as NewsAsset,
        name: 'CNBC Investing',
    },
    {
        url: 'https://finance.yahoo.com/rss/headline?s=%5EGSPC',
        asset: 'EQUITIES' as NewsAsset,
        name: 'Yahoo Finance S&P 500',
    },
    {
        url: 'https://finance.yahoo.com/rss/headline?s=%5EIXIC',
        asset: 'EQUITIES' as NewsAsset,
        name: 'Yahoo Finance Nasdaq',
    },
    {
        url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
        asset: 'EQUITIES' as NewsAsset,
        name: 'WSJ World News',
    },
    {
        url: 'https://www.nasdaq.com/feed/rssoutbound?category=Markets',
        asset: 'EQUITIES' as NewsAsset,
        name: 'Nasdaq Markets',
    },
    {
        url: 'https://www.investing.com/rss/stock_stock_picks.rss',
        asset: 'EQUITIES' as NewsAsset,
        name: 'Investing.com Stock Picks',
    },
    {
        url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
        asset: 'EQUITIES' as NewsAsset,
        name: 'MarketWatch DJ Feed',
    },

    // ═══════════════════════════════════════════════
    //  FOREX / CURRENCIES
    // ═══════════════════════════════════════════════
    {
        url: 'https://www.forexlive.com/feed/news',
        asset: 'FOREX' as NewsAsset,
        name: 'ForexLive',
    },
    {
        url: 'https://www.fxstreet.com/rss',
        asset: 'FOREX' as NewsAsset,
        name: 'FXStreet',
    },
    {
        url: 'https://www.investing.com/rss/news_1.rss',
        asset: 'FOREX' as NewsAsset,
        name: 'Investing.com Forex',
    },

    {
        url: 'https://finance.yahoo.com/rss/headline?s=EURUSD%3DX',
        asset: 'FOREX' as NewsAsset,
        name: 'Yahoo Finance EUR/USD',
    },
    {
        url: 'https://finance.yahoo.com/rss/headline?s=DX-Y.NYB',
        asset: 'FOREX' as NewsAsset,
        name: 'Yahoo Finance DXY',
    },
];
