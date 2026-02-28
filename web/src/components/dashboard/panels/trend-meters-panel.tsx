import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import type { Candle } from '@/types/market';

function MeterBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / max) * 100));
  const isPositive = value >= 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono tabular-nums font-medium ${isPositive ? 'text-buy' : 'text-sell'}`}>
          {value > 0 ? '+' : ''}{value.toFixed(0)}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
        {isPositive ? (
          <>
            <div className="w-1/2" />
            <div className="bg-buy rounded-r-full transition-all" style={{ width: `${pct / 2}%` }} />
          </>
        ) : (
          <>
            <div className="flex-1" />
            <div className="bg-sell rounded-l-full transition-all" style={{ width: `${pct / 2}%` }} />
            <div className="w-1/2" />
          </>
        )}
      </div>
    </div>
  );
}

export function TrendMetersPanel() {
  const { t } = useTranslation();
  const { currentSymbol, currentTimeframe } = useMarket();
  const { data: historyResp } = useHistory(currentSymbol, currentTimeframe, 200);
  const candles: Candle[] = useMemo(() => (historyResp as any)?.data ?? historyResp ?? [], [historyResp]);
  const ind = useIndicators(candles);

  const combo = ind?.proCombo;
  const blocks = combo?.blocks ?? {};

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          {t('dashboard.trendMeters')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {/* Overall */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{t('indicators.overall')}</span>
          <span
            className={`text-sm font-bold ${
              (combo?.score ?? 0) > 30 ? 'text-buy' : (combo?.score ?? 0) < -30 ? 'text-sell' : 'text-muted-foreground'
            }`}
          >
            {combo?.direction ?? '—'} ({combo?.score?.toFixed(0) ?? 0})
          </span>
        </div>

        {/* Confidence bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              (combo?.score ?? 0) > 0 ? 'bg-buy' : 'bg-sell'
            }`}
            style={{ width: `${Math.min(100, Math.abs(combo?.score ?? 0))}%` }}
          />
        </div>

        {/* Block breakdown */}
        <div className="space-y-1.5 pt-1">
          {Object.entries(blocks).map(([key, val]: [string, any]) => (
            <MeterBar key={key} label={key} value={val?.score ?? 0} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
