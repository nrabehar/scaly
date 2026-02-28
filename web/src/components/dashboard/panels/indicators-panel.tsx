import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import type { Candle } from '@/types/market';

function Indicator({ label, value, color }: { label: string; value: string | number | null; color?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className={`font-mono text-xs tabular-nums font-medium ${color ?? ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export function IndicatorsPanel() {
  const { t } = useTranslation();
  const { currentSymbol, currentTimeframe } = useMarket();
  const { data: historyResp } = useHistory(currentSymbol, currentTimeframe, 200);
  const candles: Candle[] = useMemo(() => (historyResp as any)?.data ?? historyResp ?? [], [historyResp]);
  const ind = useIndicators(candles);

  if (!ind) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('dashboard.indicators')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 text-xs text-muted-foreground">
          {t('common.loading')}
        </CardContent>
      </Card>
    );
  }

  const rsiColor = (v: number | null) => {
    if (v == null) return '';
    return v > 70 ? 'text-sell' : v < 30 ? 'text-buy' : '';
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t('dashboard.indicators')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-x-4">
          {/* Column 1 – Trend & Momentum */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {t('indicators.trend')}
            </p>
            <Indicator label="EMA 9" value={ind.ema9?.toFixed(2) ?? null} />
            <Indicator label="EMA 21" value={ind.ema21?.toFixed(2) ?? null} />
            <Indicator label="EMA 50" value={ind.ema50?.toFixed(2) ?? null} />
            <Indicator label="ADX" value={ind.adx?.adx?.toFixed(1) ?? null} />
            <Indicator
              label={t('indicators.trend')}
              value={ind.trend?.direction ?? '—'}
              color={ind.trend?.direction === 'BULLISH' ? 'text-buy' : ind.trend?.direction === 'BEARISH' ? 'text-sell' : ''}
            />

            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2 mb-1">
              {t('indicators.momentum')}
            </p>
            <Indicator label="RSI(14)" value={ind.rsi?.toFixed(1) ?? null} color={rsiColor(ind.rsi ?? null)} />
            <Indicator label="MACD" value={ind.macdLine?.toFixed(2) ?? null} />
            <Indicator label="Signal" value={ind.macdSignal?.toFixed(2) ?? null} />
            <Indicator label="Histogram" value={ind.macdHistogram?.toFixed(3) ?? null}
              color={ind.macdHistogram != null ? (ind.macdHistogram > 0 ? 'text-buy' : 'text-sell') : ''} />
            <Indicator label="Stoch %K" value={ind.stochastic?.k?.toFixed(1) ?? null} />
            <Indicator label="Stoch %D" value={ind.stochastic?.d?.toFixed(1) ?? null} />
            <Indicator label="Williams %R" value={ind.williamsR?.toFixed(1) ?? null} />
            <Indicator label="CCI" value={ind.cci?.toFixed(1) ?? null} />
            <Indicator label="StochRSI %K" value={ind.stochRsi?.k?.toFixed(1) ?? null} />
          </div>

          {/* Column 2 – Volume & Volatility */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {t('indicators.volume')}
            </p>
            <Indicator label="MFI" value={ind.mfi?.toFixed(1) ?? null} />
            <Indicator label="VWAP" value={ind.vwap?.toFixed(2) ?? null} />
            <Indicator label="OBV" value={ind.obv?.value != null ? (Math.abs(ind.obv.value) > 1e6 ? `${(ind.obv.value / 1e6).toFixed(1)}M` : ind.obv.value.toFixed(0)) : null} />
            <Indicator label="CVD" value={ind.cvd?.value != null ? (Math.abs(ind.cvd.value) > 1e6 ? `${(ind.cvd.value / 1e6).toFixed(1)}M` : ind.cvd.value.toFixed(0)) : null} />

            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2 mb-1">
              {t('indicators.volatility')}
            </p>
            <Indicator label="BB Upper" value={ind.bbUpper?.toFixed(2) ?? null} />
            <Indicator label="BB Middle" value={ind.bbMiddle?.toFixed(2) ?? null} />
            <Indicator label="BB Lower" value={ind.bbLower?.toFixed(2) ?? null} />
            <Indicator label="ATR(14)" value={ind.atr?.toFixed(2) ?? null} />
            <Indicator label="Keltner U" value={ind.keltner?.upper?.toFixed(2) ?? null} />
            <Indicator label="Keltner L" value={ind.keltner?.lower?.toFixed(2) ?? null} />
            <Indicator
              label="BB Squeeze"
              value={ind.bbSqueeze ? 'YES' : 'NO'}
              color={ind.bbSqueeze ? 'text-gold' : ''}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
