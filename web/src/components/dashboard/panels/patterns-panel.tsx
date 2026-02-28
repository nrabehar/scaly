import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shapes } from 'lucide-react';
import type { Candle } from '@/types/market';

export function PatternsPanel() {
  const { t } = useTranslation();
  const { currentSymbol, currentTimeframe } = useMarket();
  const { data: historyResp } = useHistory(currentSymbol, currentTimeframe, 200);
  const candles: Candle[] = useMemo(() => (historyResp as any)?.data ?? historyResp ?? [], [historyResp]);
  const ind = useIndicators(candles);

  const patterns = ind?.patterns ?? [];
  const orderBlocks = ind?.orderBlocks ?? [];
  const fvgs = ind?.fvgs ?? [];
  const fibonacci = ind?.fibonacci;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shapes className="h-4 w-4" />
          {t('dashboard.patterns')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Candlestick Patterns */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {t('patterns.candlestick')}
          </p>
          {patterns.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('patterns.none')}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {patterns.map((p: any, i: number) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[10px] ${p.bias === 'bullish' ? 'border-buy text-buy' : p.bias === 'bearish' ? 'border-sell text-sell' : ''}`}
                >
                  {p.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Order Blocks */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {t('patterns.orderBlocks')}
          </p>
          {orderBlocks.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('patterns.none')}</p>
          ) : (
            <div className="space-y-0.5 text-xs font-mono tabular-nums">
              {orderBlocks.slice(0, 4).map((ob: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className={ob.type === 'bullish' ? 'text-buy' : 'text-sell'}>
                    {ob.type?.toUpperCase()} OB
                  </span>
                  <span>{ob.high?.toFixed(2)} – {ob.low?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FVGs */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {t('patterns.fvg')}
          </p>
          {fvgs.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('patterns.none')}</p>
          ) : (
            <div className="space-y-0.5 text-xs font-mono tabular-nums">
              {fvgs.slice(0, 4).map((fvg: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className={fvg.type === 'bullish' ? 'text-buy' : 'text-sell'}>
                    {fvg.type?.toUpperCase()} FVG
                  </span>
                  <span>{fvg.high?.toFixed(2)} – {fvg.low?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fibonacci */}
        {fibonacci && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Fibonacci
            </p>
            <div className="space-y-0.5 text-xs font-mono tabular-nums">
              {Object.entries(fibonacci.levels ?? {}).map(([lvl, price]: [string, any]) => (
                <div key={lvl} className="flex justify-between">
                  <span className="text-muted-foreground">{lvl}</span>
                  <span>{price?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
