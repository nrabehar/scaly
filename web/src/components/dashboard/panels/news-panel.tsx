import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useNews } from '@/hooks/use-market-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function NewsPanel() {
  const { t } = useTranslation();
  const { currentSymbol } = useMarket();
  const [mode, setMode] = useState<'focus' | 'global'>('global');
  const { data: newsResp } = useNews(mode === 'focus' ? currentSymbol : 'GLOBAL');
  const items: any[] = (newsResp as any)?.items ?? newsResp ?? [];

  const sentimentColor = (s?: string) => {
    if (!s) return '';
    const lower = s.toLowerCase();
    if (lower === 'positive' || lower === 'bullish') return 'border-buy text-buy';
    if (lower === 'negative' || lower === 'bearish') return 'border-sell text-sell';
    return '';
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          {t('dashboard.news')}
          <div className="ml-auto flex gap-1">
            <button
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                mode === 'global' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setMode('global')}
            >
              {t('news.global')}
            </button>
            <button
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                mode === 'focus' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => setMode('focus')}
            >
              {t('news.focus')}
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="space-y-2 max-h-[280px] overflow-y-auto trading-scroll">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('news.noNews')}</p>
          )}
          {items.slice(0, 15).map((item: any, i: number) => (
            <div key={i} className="border-b border-border/50 pb-1.5 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={item.link ?? item.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:underline line-clamp-2 flex-1"
                >
                  {item.title}
                </a>
                {item.sentiment && (
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${sentimentColor(item.sentiment)}`}>
                    {item.sentiment}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {item.source && (
                  <span className="text-[10px] text-muted-foreground">{item.source}</span>
                )}
                {(item.pubDate || item.ts) && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.pubDate ?? item.ts), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
