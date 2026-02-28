import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { usePrice, useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { useMemo } from 'react';
import type { Candle } from '@/types/market';

export function MarketInfoPanel() {
  const { t } = useTranslation();
  const { currentSymbol, currentTimeframe } = useMarket();
  const { data: price } = usePrice(currentSymbol);
  const { data: historyResp } = useHistory(currentSymbol, currentTimeframe, 200);
  const candles: Candle[] = useMemo(() => (historyResp as any)?.data ?? historyResp ?? [], [historyResp]);
  const ind = useIndicators(candles);

  const spread = price?.bid != null && price?.ask != null ? price.ask - price.bid : null;
  const last = candles.length > 0 ? candles[candles.length - 1] : null;

  const rows = [
    { label: t('market.bid'), value: price?.bid?.toFixed(2) },
    { label: t('market.ask'), value: price?.ask?.toFixed(2) },
    { label: t('market.spread'), value: spread?.toFixed(2) },
    { label: t('market.high'), value: last?.high?.toFixed(2) },
    { label: t('market.low'), value: last?.low?.toFixed(2) },
    { label: 'VWAP', value: ind?.vwap?.toFixed(2) },
    { label: 'ATR(14)', value: ind?.atr?.toFixed(2) },
    { label: t('market.source'), value: price?.source ?? '—' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Info className="h-4 w-4" />
          {t('dashboard.marketInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="space-y-0.5">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between items-center py-0.5">
              <span className="text-[11px] text-muted-foreground">{row.label}</span>
              <span className="font-mono text-xs tabular-nums font-medium">{row.value ?? '—'}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
