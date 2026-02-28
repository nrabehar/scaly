import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Target } from 'lucide-react';
import type { Candle } from '@/types/market';

export function CompositeScorePanel() {
  const { t } = useTranslation();
  const { currentSymbol, currentTimeframe } = useMarket();
  const { data: historyResp } = useHistory(currentSymbol, currentTimeframe, 200);
  const candles: Candle[] = useMemo(() => (historyResp as any)?.data ?? historyResp ?? [], [historyResp]);
  const ind = useIndicators(candles);

  const score = ind?.proCombo?.score ?? 0;
  const direction = ind?.proCombo?.direction ?? 'NEUTRAL';
  const confidence = ind?.proCombo?.confidence ?? 0;

  // Gauge: half-pie from -100 to +100
  const normalized = (score + 100) / 2; // 0–100
  const gaugeData = [
    { value: normalized },
    { value: 100 - normalized },
  ];

  const gaugeColor = score > 30 ? '#26a65b' : score < -30 ? '#ef4444' : '#6b7280';

  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          {t('dashboard.compositeScore')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 flex flex-col items-center">
        <div className="w-full h-[120px] min-w-[100px] relative overflow-hidden">
          <ResponsiveContainer width="99%" height={118}>
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="90%"
                startAngle={180}
                endAngle={0}
                innerRadius="60%"
                outerRadius="100%"
                dataKey="value"
                stroke="none"
              >
                <Cell fill={gaugeColor} />
                <Cell fill="hsl(var(--muted))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: gaugeColor }}>
              {score > 0 ? '+' : ''}{score.toFixed(0)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {direction}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="text-muted-foreground">{t('indicators.confidence')}</span>
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="font-mono tabular-nums">{confidence.toFixed(0)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
