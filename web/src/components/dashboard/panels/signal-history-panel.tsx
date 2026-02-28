import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useSignalHistory, useSignalAccuracy } from '@/hooks/use-market-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { format } from 'date-fns';

export function SignalHistoryPanel() {
  const { t } = useTranslation();
  const { currentSymbol } = useMarket();
  const { data: histResp } = useSignalHistory(currentSymbol);
  const { data: accResp } = useSignalAccuracy(currentSymbol);

  const signals: any[] = (histResp as any)?.signals ?? [];
  const accuracy = accResp as any;

  const signalBadge = (side?: string) => {
    if (!side) return 'outline';
    const s = side.toUpperCase();
    if (s === 'BUY' || s === 'LONG') return 'default' as const;
    if (s === 'SELL' || s === 'SHORT') return 'destructive' as const;
    return 'outline' as const;
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          {t('dashboard.signalHistory')}
          {accuracy && (
            <span className="ml-auto text-xs text-muted-foreground">
              {t('signals.winRate')}: <span className="font-mono text-buy">{accuracy.winRate?.toFixed(1) ?? 0}%</span>
              {' · '}
              {t('signals.total')}: {accuracy.total ?? 0}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="max-h-[200px] overflow-y-auto trading-scroll">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left pb-1">{t('signals.time')}</th>
                <th className="text-left pb-1">{t('signals.symbol')}</th>
                <th className="text-center pb-1">{t('signals.signal')}</th>
                <th className="text-right pb-1">{t('signals.entry')}</th>
                <th className="text-right pb-1">TP</th>
                <th className="text-right pb-1">SL</th>
                <th className="text-right pb-1">{t('signals.result')}</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-muted-foreground">
                    {t('signals.noSignals')}
                  </td>
                </tr>
              )}
              {signals.slice(0, 50).map((s: any, i: number) => (
                <tr key={s.id ?? i} className="border-t border-border/50">
                  <td className="py-1 font-mono tabular-nums text-muted-foreground">
                    {s.createdAt ? format(new Date(s.createdAt), 'MM/dd HH:mm') : '—'}
                  </td>
                  <td className="py-1">{s.symbol ?? '—'}</td>
                  <td className="py-1 text-center">
                    <Badge variant={signalBadge(s.side ?? s.signal)} className="text-[9px] h-4">
                      {s.side ?? s.signal ?? '—'}
                    </Badge>
                  </td>
                  <td className="py-1 text-right font-mono tabular-nums">{s.entry?.toFixed(2) ?? '—'}</td>
                  <td className="py-1 text-right font-mono tabular-nums text-buy">{s.tp?.toFixed(2) ?? '—'}</td>
                  <td className="py-1 text-right font-mono tabular-nums text-sell">{s.sl?.toFixed(2) ?? '—'}</td>
                  <td className={`py-1 text-right font-mono tabular-nums ${
                    s.result === 'WIN' ? 'text-buy' : s.result === 'LOSS' ? 'text-sell' : 'text-muted-foreground'
                  }`}>
                    {s.result ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
