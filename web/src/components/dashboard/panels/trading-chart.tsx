import { useEffect, useRef, useCallback, useMemo } from 'react';
import { createChart, type IChartApi, type ISeriesApi, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { useMarket } from '@/contexts/market.context';
import { useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import type { Candle } from '@/types/market';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

function candleToLW(c: Candle) {
  return {
    time: (c.time / 1000) as any, // lightweight-charts expects UTC seconds
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function volumeToLW(c: Candle) {
  return {
    time: (c.time / 1000) as any,
    value: c.volume ?? 0,
    color: c.close >= c.open ? 'rgba(38,166,91,0.35)' : 'rgba(239,68,68,0.35)',
  };
}

export function TradingChart() {
  const { t } = useTranslation();
  const { currentSymbol, currentTimeframe } = useMarket();
  const { data: historyResp } = useHistory(currentSymbol, currentTimeframe, 300);
  const candles: Candle[] = useMemo(() => (historyResp as any)?.data ?? historyResp ?? [], [historyResp]);
  const indicators = useIndicators(candles);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const ema9Ref = useRef<ISeriesApi<any> | null>(null);
  const ema21Ref = useRef<ISeriesApi<any> | null>(null);

  // Create chart once
  const initChart = useCallback(() => {
    if (!containerRef.current) return;
    if (chartRef.current) chartRef.current.remove();

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.08)' },
        horzLines: { color: 'rgba(148,163,184,0.08)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.15)' },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: '#26a65b',
      downColor: '#ef4444',
      borderUpColor: '#26a65b',
      borderDownColor: '#ef4444',
      wickUpColor: '#26a65b',
      wickDownColor: '#ef4444',
    });

    const vs = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ema9 = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, priceLineVisible: false });
    const ema21 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false });

    chartRef.current = chart;
    candleSeriesRef.current = cs;
    volumeSeriesRef.current = vs;
    ema9Ref.current = ema9;
    ema21Ref.current = ema21;
  }, []);

  // Init on mount
  useEffect(() => {
    initChart();
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [initChart]);

  // Update data when candles change
  useEffect(() => {
    if (!candles.length) return;
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const lwCandles = sorted.map(candleToLW);
    const lwVolume = sorted.map(volumeToLW);

    candleSeriesRef.current?.setData(lwCandles);
    volumeSeriesRef.current?.setData(lwVolume);

    // EMA overlays
    if (indicators) {
      const closes = sorted.map((c) => c.close);
      const buildEMA = (period: number) => {
        const k = 2 / (period + 1);
        const vals: { time: any; value: number }[] = [];
        let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < closes.length; i++) {
          ema = closes[i] * k + ema * (1 - k);
          vals.push({ time: lwCandles[i].time, value: ema });
        }
        return vals;
      };
      ema9Ref.current?.setData(buildEMA(9));
      ema21Ref.current?.setData(buildEMA(21));
    }

    chartRef.current?.timeScale().fitContent();
  }, [candles, indicators]);

  return (
    <Card className="col-span-full lg:col-span-2 row-span-2">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {t('dashboard.chart')}
          <span className="text-xs text-muted-foreground font-mono">{currentSymbol} · {currentTimeframe}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-1 px-1">
        <div ref={containerRef} className="w-full h-[420px]" />
      </CardContent>
    </Card>
  );
}
