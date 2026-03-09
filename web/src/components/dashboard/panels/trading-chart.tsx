import { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    ColorType,
    CrosshairMode,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
} from 'lightweight-charts';
import { useMarket } from '@/contexts/market.context';
import {
    useHistory,
    usePrice,
    useSignalLive,
} from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import type { Candle, SmcZone } from '@/types/market';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

/** Seconds per candle bucket for each timeframe (used for live tick bucketing). */
const TF_SECONDS: Record<string, number> = {
	'1s': 1,
	'5s': 5,
	'15s': 15,
	'30s': 30,
	'1min': 60,
	'5min': 300,
	'15min': 900,
	'1h': 3600,
	'4h': 14400,
	'1D': 86400,
};

function candleToLW(c: Candle) {
	return {
		time: (Number(c.time) / 1000) as any,
		open: c.open,
		high: c.high,
		low: c.low,
		close: c.close,
	};
}
function volumeToLW(c: Candle) {
	return {
		time: (Number(c.time) / 1000) as any,
		value: c.volume ?? 0,
		color:
			c.close >= c.open
				? 'rgba(38,166,91,0.35)'
				: 'rgba(239,68,68,0.35)',
	};
}

export function TradingChart() {
	const { t } = useTranslation();
	const { currentSymbol, currentTimeframe } = useMarket();
	const { data: historyResp } = useHistory(
		currentSymbol,
		currentTimeframe,
		300,
	);
	const { data: priceTick } = usePrice(currentSymbol);
	const { data: liveSignal } = useSignalLive(currentSymbol);

	const candles: Candle[] = useMemo(
		() => (historyResp as any)?.data ?? historyResp ?? [],
		[historyResp],
	);
	const indicators = useIndicators(candles);

	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
	const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
	const ema9Ref = useRef<ISeriesApi<any> | null>(null);
	const ema21Ref = useRef<ISeriesApi<any> | null>(null);
	const zoneCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const zoneSignalRef = useRef<typeof liveSignal | null>(null);
	/** Current in-progress candle bucket built from price ticks. */
	const liveCandleRef = useRef<{
		time: number;
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
	} | null>(null);

	// ── Zone canvas overlay ───────────────────────────────────────────────────
	const drawZoneCanvas = useCallback(() => {
		const canvas = zoneCanvasRef.current;
		const cs = candleSeriesRef.current;
		const chart = chartRef.current;
		const cont = containerRef.current;
		if (!canvas || !cs || !chart || !cont) return;

		const w = cont.clientWidth,
			h = cont.clientHeight;
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, w, h);

		const signal = zoneSignalRef.current;
		if (!signal?.smc) return;

		// Reserve space for the right-hand price scale (~72 px is typical for LW).
		const SCALE_W = 72;
		const chartW = w - SCALE_W;

		/**
		 * Convert a price to a canvas Y coordinate, clamped to the chart
		 * drawing area so zones never bleed outside the visible candle region.
		 */
		const py = (p: number): number | null => {
			if (!p || !Number.isFinite(p)) return null;
			const c = cs.priceToCoordinate(p);
			if (c == null) return null;
			// Clamp: coordinate can be a large negative / large positive value
			// when LW extrapolates outside the visible price range.
			return Math.max(0, Math.min(h, c as number));
		};
		const tx = (ms: number): number => {
			if (!ms) return 0;
			const x = chart
				.timeScale()
				.timeToCoordinate((ms / 1000) as any);
			return x != null
				? Math.max(0, Math.min(chartW, x as number))
				: 0;
		};
		const drawZone = (
			originMs: number | null | undefined,
			pTop: number,
			pBot: number,
			fill: string,
			stroke: string,
			label: string,
		) => {
			// Guard: skip degenerate / missing price values
			if (
				!pTop ||
				!pBot ||
				!Number.isFinite(pTop) ||
				!Number.isFinite(pBot)
			)
				return;
			const y1 = py(pTop),
				y2 = py(pBot);
			if (y1 == null || y2 == null) return;
			const yT = Math.min(y1, y2),
				yB = Math.max(y1, y2),
				bh = yB - yT;
			// Skip invisible zones and unreasonably tall ones (>60 % of chart)
			if (bh < 1 || bh > h * 0.6) return;
			const xL = originMs ? tx(originMs) : 0,
				bw = chartW - xL;
			if (bw < 2) return;
			ctx.fillStyle = fill;
			ctx.fillRect(xL, yT, bw, bh);
			ctx.strokeStyle = stroke;
			ctx.lineWidth = 1.5;
			ctx.setLineDash([]);
			ctx.beginPath();
			ctx.moveTo(xL, yT);
			ctx.lineTo(chartW, yT);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(xL, yB);
			ctx.lineTo(chartW, yB);
			ctx.stroke();
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(xL, yT);
			ctx.lineTo(xL, yB);
			ctx.stroke();
			if (label && bh > 9) {
				ctx.fillStyle = stroke;
				ctx.font = 'bold 11px ui-monospace, monospace';
				ctx.fillText(label, xL + 7, yT + Math.min(14, bh / 2 + 5));
			}
		};

		const { smc, side } = signal;
		const isBuy = side === 'BUY';

		const breaker = smc.nearestBreaker as SmcZone | null;
		if (breaker?.top && breaker?.bottom) {
			const bull = breaker.type === 'BULLISH_BREAKER',
				c = bull ? '#14b8a6' : '#ec4899';
			drawZone(
				breaker.originTime,
				breaker.top,
				breaker.bottom,
				`${c}14`,
				`${c}99`,
				bull ? 'BB▲' : 'BB▼',
			);
			const ym = py(breaker.midpoint);
			if (ym != null) {
				const xL = breaker.originTime ? tx(breaker.originTime) : 0;
				ctx.strokeStyle = `${c}44`;
				ctx.lineWidth = 1;
				ctx.setLineDash([3, 7]);
				ctx.beginPath();
				ctx.moveTo(xL, ym);
				ctx.lineTo(chartW, ym);
				ctx.stroke();
				ctx.setLineDash([]);
			}
		}
		const fvg = smc.nearestFvg as SmcZone | null;
		if (fvg?.top && fvg?.bottom)
			drawZone(
				fvg.originTime,
				fvg.top,
				fvg.bottom,
				'rgba(168,85,247,0.08)',
				'rgba(168,85,247,0.55)',
				'FVG',
			);

		const ob = smc.nearestOb as SmcZone | null;
		if (ob?.top && ob?.bottom) {
			const c = isBuy ? '#14b8a6' : '#f97316';
			drawZone(
				ob.originTime,
				ob.top,
				ob.bottom,
				`${c}14`,
				`${c}cc`,
				`OB${ob.mitigated === 0 ? ' ★' : ''}`,
			);
		}
	}, []);

	const initChart = useCallback(() => {
		if (!containerRef.current) return;
		if (chartRef.current) chartRef.current.remove();

		const chart = createChart(containerRef.current, {
			autoSize: true,
			layout: {
				background: {
					type: ColorType.Solid,
					color: 'transparent',
				},
				textColor: '#8b92a8',
				fontSize: 11,
			},
			grid: {
				vertLines: { color: 'rgba(120,80,20,0.12)' },
				horzLines: { color: 'rgba(120,80,20,0.10)' },
			},
			crosshair: { mode: CrosshairMode.Normal },
			rightPriceScale: { borderColor: 'rgba(180,120,30,0.20)' },
			timeScale: {
				borderColor: 'rgba(180,120,30,0.20)',
				timeVisible: true,
				secondsVisible: false,
			},
			handleScroll: true,
			handleScale: true,
		});

		const cs = chart.addSeries(CandlestickSeries, {
			upColor: '#10b981',
			downColor: '#f43f5e',
			borderUpColor: '#10b981',
			borderDownColor: '#f43f5e',
			wickUpColor: '#10b981',
			wickDownColor: '#f43f5e',
		});
		const vs = chart.addSeries(HistogramSeries, {
			priceFormat: { type: 'volume' },
			priceScaleId: 'volume',
		});
		chart
			.priceScale('volume')
			.applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
		const e9 = chart.addSeries(LineSeries, {
			color: '#f97316',
			lineWidth: 1,
			priceLineVisible: false,
		});
		const e21 = chart.addSeries(LineSeries, {
			color: '#64748b',
			lineWidth: 1,
			priceLineVisible: false,
		});

		chartRef.current = chart;
		candleSeriesRef.current = cs;
		volumeSeriesRef.current = vs;
		ema9Ref.current = e9;
		ema21Ref.current = e21;
		liveCandleRef.current = null;
	}, []);

	// Init / reinit on symbol or timeframe change
	useEffect(() => {
		initChart();
		zoneSignalRef.current = null;
		const canvas = zoneCanvasRef.current;
		if (canvas) {
			const ctx = canvas.getContext('2d');
			ctx?.clearRect(0, 0, canvas.width, canvas.height);
		}

		const chart = chartRef.current;
		if (chart)
			chart
				.timeScale()
				.subscribeVisibleLogicalRangeChange(drawZoneCanvas);

		const ro = new ResizeObserver(drawZoneCanvas);
		if (containerRef.current) ro.observe(containerRef.current);

		return () => {
			ro.disconnect();
			chartRef.current
				?.timeScale()
				.unsubscribeVisibleLogicalRangeChange(drawZoneCanvas);
			candleSeriesRef.current = null;
			volumeSeriesRef.current = null;
			ema9Ref.current = null;
			ema21Ref.current = null;
			chartRef.current?.remove();
			chartRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initChart, currentSymbol, currentTimeframe, drawZoneCanvas]);

	// Load historical candles
	useEffect(() => {
		candleSeriesRef.current?.setData([]);
		volumeSeriesRef.current?.setData([]);
		ema9Ref.current?.setData([]);
		ema21Ref.current?.setData([]);
		liveCandleRef.current = null;

		if (!candles.length) return;
		const sorted = [...candles].sort(
			(a, b) => Number(a.time) - Number(b.time),
		);
		const lwC = sorted.map(candleToLW);
		const lwV = sorted.map(volumeToLW);

		candleSeriesRef.current?.setData(lwC);
		volumeSeriesRef.current?.setData(lwV);

		if (indicators) {
			const closes = sorted.map((c) => c.close);
			const buildEMA = (period: number) => {
				const k = 2 / (period + 1);
				const vals: { time: any; value: number }[] = [];
				let ema =
					closes.slice(0, period).reduce((a, b) => a + b, 0) /
					period;
				for (let i = period; i < closes.length; i++) {
					ema = closes[i] * k + ema * (1 - k);
					vals.push({ time: lwC[i].time, value: ema });
				}
				return vals;
			};
			ema9Ref.current?.setData(buildEMA(9));
			ema21Ref.current?.setData(buildEMA(21));
		}
		chartRef.current?.timeScale().fitContent();
	}, [candles, indicators]);

	// Real-time tick → update current candle live (no full reload needed)
	useEffect(() => {
		if (!priceTick?.price) return;
		const cs = candleSeriesRef.current,
			vs = volumeSeriesRef.current;
		if (!cs || !vs) return;

		const price = priceTick.price;
		const tfSec = TF_SECONDS[currentTimeframe] ?? 60;
		const nowSec = Math.floor(Date.now() / 1000);
		const bucket = Math.floor(nowSec / tfSec) * tfSec;

		const prev = liveCandleRef.current;
		if (prev && prev.time === bucket) {
			const upd = {
				...prev,
				high: Math.max(prev.high, price),
				low: Math.min(prev.low, price),
				close: price,
			};
			liveCandleRef.current = upd;
			cs.update({
				time: bucket as any,
				open: upd.open,
				high: upd.high,
				low: upd.low,
				close: upd.close,
			});
			vs.update({
				time: bucket as any,
				value: upd.volume,
				color:
					upd.close >= upd.open
						? 'rgba(38,166,91,0.35)'
						: 'rgba(239,68,68,0.35)',
			});
		} else {
			const fresh = {
				time: bucket,
				open: price,
				high: price,
				low: price,
				close: price,
				volume: 0,
			};
			liveCandleRef.current = fresh;
			cs.update({
				time: bucket as any,
				open: price,
				high: price,
				low: price,
				close: price,
			});
			vs.update({
				time: bucket as any,
				value: 0,
				color: 'rgba(38,166,91,0.35)',
			});
		}
	}, [priceTick, currentTimeframe]);

	// Zone canvas (OB / FVG / Breaker rectangles)
	useEffect(() => {
		zoneSignalRef.current = liveSignal ?? null;
		drawZoneCanvas();
	}, [liveSignal, drawZoneCanvas]);

	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, ease: 'easeOut' }}
		>
			<Card className="w-full card-accent-top overflow-hidden">
				<CardHeader className="pb-2 pt-3 px-4">
					<CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 glow-pulse" />
						{t('dashboard.chart')}
						<span className="text-xs text-muted-foreground font-mono">
							{currentSymbol} · {currentTimeframe}
						</span>

						{liveSignal?.plan &&
							liveSignal.side &&
							liveSignal.side !== 'HOLD' &&
							(() => {
								const { plan, side } = liveSignal;
								const buy = side === 'BUY';
								return (
									<span
										className={`ml-auto flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded border ${buy ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' : 'text-rose-400 bg-rose-400/10 border-rose-400/30'}`}
									>
										<span
											className={`font-bold ${buy ? 'text-emerald-400' : 'text-rose-400'}`}
										>
											{side}
										</span>
										<span>
											@ {plan.entry?.toFixed(2)}
										</span>
										<span className="text-emerald-400">
											TP {plan.tp?.toFixed(2)}
										</span>
										<span className="text-rose-400">
											SL {plan.sl?.toFixed(2)}
										</span>
										<span className="text-amber-400">
											{plan.rr?.toFixed(1)}R
										</span>
									</span>
								);
							})()}
					</CardTitle>
				</CardHeader>
				<CardContent className="p-0 pb-1 px-1">
					<div
						ref={containerRef}
						className="w-full h-125 relative"
					>
						<canvas
							ref={zoneCanvasRef}
							className="absolute inset-0 pointer-events-none"
							style={{ zIndex: 10 }}
						/>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
