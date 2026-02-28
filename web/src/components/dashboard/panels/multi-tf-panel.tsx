import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useMultiTF } from '@/hooks/use-market-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { calcRSI } from '@/lib/indicators/momentum';
import { calcEMA } from '@/lib/indicators/trend';

const TIMEFRAMES = ['1min', '5min', '15min', '1h'] as const;

function analyzeTF(data: any[] | undefined) {
  if (!data || data.length < 30) return { rsi: null, trend: null as string | null, signal: null as string | null };
  const closes = data.map((c: any) => c.close);
  const rsi = calcRSI(closes, 14);
  const ema9a = calcEMA(closes, 9);
  const ema21a = calcEMA(closes, 21);

  // Simple EMA-based trend direction
  let trend: string = 'NEUTRAL';
  if (ema9a && ema21a && ema9a.length > 0 && ema21a.length > 0) {
    const ema9 = ema9a[ema9a.length - 1];
    const ema21 = ema21a[ema21a.length - 1];
    trend = ema9 > ema21 ? 'BULLISH' : ema9 < ema21 ? 'BEARISH' : 'NEUTRAL';
  }

  let signal = 'NEUTRAL';
  if (rsi !== null) {
    if (rsi < 35 && trend === 'BULLISH') signal = 'BUY';
    else if (rsi > 65 && trend === 'BEARISH') signal = 'SELL';
    else if (trend === 'BULLISH') signal = 'LEAN BUY';
    else if (trend === 'BEARISH') signal = 'LEAN SELL';
  }
  return { rsi, trend, signal };
}

export function MultiTFPanel() {
  const { t } = useTranslation();
  const { currentSymbol } = useMarket();
  const { data: multiResp } = useMultiTF(currentSymbol);

  const frames = (multiResp as any)?.frames ?? {};

  const signalColor = (s: string | null) => {
    if (!s) return '';
    if (s.includes('BUY')) return 'text-buy';
    if (s.includes('SELL')) return 'text-sell';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4" />
          {t('dashboard.multiTF')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left pb-1">TF</th>
              <th className="text-right pb-1">RSI</th>
              <th className="text-right pb-1">{t('indicators.trend')}</th>
              <th className="text-right pb-1">{t('signals.signal')}</th>
            </tr>
          </thead>
          <tbody>
            {TIMEFRAMES.map((tf) => {
              const d = frames[tf]?.data;
              const analysis = analyzeTF(d);
              return (
                <tr key={tf} className="border-t border-border/50">
                  <td className="py-1 font-medium">{tf}</td>
                  <td className="text-right font-mono tabular-nums">
                    {analysis.rsi?.toFixed(1) ?? '—'}
                  </td>
                  <td className={`text-right ${analysis.trend === 'BULLISH' ? 'text-buy' : analysis.trend === 'BEARISH' ? 'text-sell' : ''}`}>
                    {analysis.trend ?? '—'}
                  </td>
                  <td className={`text-right font-medium ${signalColor(analysis.signal)}`}>
                    {analysis.signal ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
