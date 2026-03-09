/**
 * TradingChart — dual-provider chart (Scaly lightweight-charts + TradingView widget)
 */
import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import { useMarket } from '@/contexts/market.context';
import { useHistory, useSignalLive } from '@/hooks/use-market-data';
import { subscribeLiveTick } from '@/lib/liveTickBus';
import { computeAll } from '@/lib/indicators';
import type { Candle, SmcZone, TimeframeType } from '@/types/market';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

// ─── Constants ──────────────────────────────────────────────────────────────

const SYMBOL_DECIMALS: Record<string, number> = {
	'XAU/USD': 2,
	'BTC/USD': 2,
	'ETH/USD': 2,
	'EUR/USD': 5,
	'GBP/USD': 5,
};

const TRADINGVIEW_SYMBOL_MAP: Record<string, string> = {
	'XAU/USD': 'OANDA:XAUUSD',
	'BTC/USD': 'BINANCE:BTCUSDT',
	'ETH/USD': 'BINANCE:ETHUSDT',
	'EUR/USD': 'OANDA:EURUSD',
	'GBP/USD': 'OANDA:GBPUSD',
};

const FAST_TIMEFRAMES: TimeframeType[] = ['1s', '5s', '15s', '30s'];
const STANDARD_TIMEFRAMES: TimeframeType[] = [
	'1min',
	'5min',
	'15min',
	'1h',
	'4h',
	'1D',
];
const TRADINGVIEW_ZOOM_TIMEFRAMES: TimeframeType[] = [
	'1min',
	'5min',
	'15min',
	'1h',
	'4h',
	'1D',
];

const HDWM_FRAME_CONFIG = [
	{ key: 'h4', title: 'H4', hours: 4, color: '#f59e0b' },
	{ key: 'daily', title: 'Daily', hours: 24, color: '#10b981' },
	{ key: 'weekly', title: 'Weekly', hours: 168, color: '#2962ff' },
	{ key: 'monthly', title: 'Monthly', hours: 720, color: '#e040fb' },
] as const;

const TV_LEVEL_ORDER = [
	'r3',
	'r2',
	'r1',
	'pivot',
	's1',
	's2',
	's3',
	'vwap',
	'poc',
	'vah',
	'val',
	'tp-trade',
	'sl-trade',
	'hdwm-h4-pivot',
	'hdwm-h4-r1',
	'hdwm-h4-s1',
	'hdwm-daily-pivot',
	'hdwm-daily-r1',
	'hdwm-daily-s1',
	'hdwm-weekly-pivot',
	'hdwm-weekly-r1',
	'hdwm-weekly-s1',
	'hdwm-monthly-pivot',
	'hdwm-monthly-r1',
	'hdwm-monthly-s1',
];

const LIVE_TICK_FRESH_MS = 8000;

// ─── Types ───────────────────────────────────────────────────────────────────

type ChartProvider = 'scaly' | 'tradingview';

interface TvOverlayLine {
	id: string;
	label: string;
	price: number;
	color: string;
	emphasis?: boolean;
	yPct: number;
}

interface HdwmFrameData {
	pivot: number;
	r1: number;
	r2: number;
	s1: number;
	s2: number;
	trueRangeTicks: number;
	fluctuationPct: number;
	volume: number;
}

interface LocalCandle {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDecimals(symbol: string) {
	return SYMBOL_DECIMALS[symbol] ?? 5;
}

function formatPrice(
	symbol: string,
	price: number | null | undefined,
): string {
	if (price == null || !Number.isFinite(price)) return '—';
	return price.toFixed(getDecimals(symbol));
}

function formatAxisPrice(symbol: string, price: number): string {
	return price.toFixed(getDecimals(symbol));
}

function formatChange(symbol: string, change: number): string {
	return `${change >= 0 ? '+' : ''}${change.toFixed(getDecimals(symbol))}`;
}

function formatTimeframeLabel(tf: string): string {
	return tf === '1min'
		? '1M'
		: tf === '5min'
			? '5M'
			: tf === '15min'
				? '15M'
				: tf === '1h'
					? '1H'
					: tf === '4h'
						? '4H'
						: tf.toUpperCase();
}

function timeframeToSeconds(tf: string): number {
	const map: Record<string, number> = {
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
	return map[tf] ?? 60;
}

function toTradingViewInterval(tf: string): string {
	const map: Record<string, string> = {
		'1s': '1',
		'5s': '1',
		'15s': '1',
		'30s': '1',
		'1min': '1',
		'5min': '5',
		'15min': '15',
		'1h': '60',
		'4h': '240',
		'1D': 'D',
	};
	return map[tf] ?? '1';
}

function getPriceFormatOptions(symbol: string) {
	const d = getDecimals(symbol);
	return {
		type: 'price' as const,
		precision: d,
		minMove: Math.pow(10, -d),
	};
}

function normalizeTimestampMs(ts: number | undefined): number {
	if (!ts || !Number.isFinite(ts)) return Date.now();
	if (ts > 1e13) return Math.floor(ts / 1000);
	if (ts > 1e12) return ts;
	return ts * 1000;
}

function formatClockWithMs(tsMs: number | null): string {
	if (tsMs == null) return '—';
	const d = new Date(tsMs);
	const ms = (d.getMilliseconds() / 10).toFixed(0).padStart(2, '0');
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${ms}`;
}

// ─── HDWM helpers ────────────────────────────────────────────────────────────

function aggregateHdwmCandles(
	candles1h: Candle[],
	periodHours: number,
): Candle[] {
	if (!candles1h || candles1h.length < periodHours) return [];
	const result: Candle[] = [];
	for (
		let i = 0;
		i + periodHours <= candles1h.length;
		i += periodHours
	) {
		const chunk = candles1h.slice(i, i + periodHours);
		if (chunk.length < Math.floor(periodHours * 0.5)) continue;
		result.push({
			open: chunk[0].open,
			high: Math.max(...chunk.map((c) => c.high)),
			low: Math.min(...chunk.map((c) => c.low)),
			close: chunk[chunk.length - 1].close,
			volume: chunk.reduce((s, c) => s + (c.volume ?? 0), 0),
			time: chunk[chunk.length - 1].time,
		});
	}
	return result;
}

function buildHdwmFrameData(aggregated: Candle[]): HdwmFrameData | null {
	if (!aggregated || aggregated.length < 2) return null;
	const last = aggregated[aggregated.length - 1];
	const { high, low, close } = last;
	const pivot = (high + low + close) / 3;
	const r1 = 2 * pivot - low,
		r2 = pivot + (high - low);
	const s1 = 2 * pivot - high,
		s2 = pivot - (high - low);
	return {
		pivot: +pivot.toFixed(5),
		r1: +r1.toFixed(5),
		r2: +r2.toFixed(5),
		s1: +s1.toFixed(5),
		s2: +s2.toFixed(5),
		trueRangeTicks: Math.round((high - low) * 100000) / 100000,
		fluctuationPct:
			low > 0 ? +(((high - low) / low) * 100).toFixed(3) : 0,
		volume: last.volume ?? 0,
	};
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TradingChart() {
	const { t } = useTranslation();
	const { currentSymbol, currentTimeframe, setCurrentTimeframe } =
		useMarket();
	// ── Provider / UI state
	const [chartProvider, setChartProvider] =
		useState<ChartProvider>('scaly');
	const [tvIframeLoaded, setTvIframeLoaded] = useState(false);
	const [showTradeLevels, setShowTradeLevels] = useState(true);
	const [showPivotLevels, setShowPivotLevels] = useState(true);
	const [showHdwmTable, setShowHdwmTable] = useState(false);
	const [tvLevelSelection, setTvLevelSelection] = useState<
		Record<string, boolean>
	>({});

	// ── Live state
	const [livePriceSnapshot, setLivePriceSnapshot] = useState<
		number | undefined
	>();
	const [liveCandleSnapshot, setLiveCandleSnapshot] =
		useState<LocalCandle | null>(null);
	const [tvLastTickTs, setTvLastTickTs] = useState<number | null>(null);
	const [tvNowTs, setTvNowTs] = useState(Date.now());
	const [countdown, setCountdown] = useState('00:00');
	const [countdownSecondsLeft, setCountdownSecondsLeft] = useState(0);

	// ── Data hooks
	const { data: historyResp } = useHistory(
		currentSymbol,
		currentTimeframe,
		300,
	);
	const { data: hdwmResp } = useHistory(currentSymbol, '1h', 2400);
	const { data: liveSignal } = useSignalLive(currentSymbol);

	// ── Candles
	const candles: Candle[] = useMemo(
		() => (historyResp as any)?.data ?? historyResp ?? [],
		[historyResp],
	);
	const hdwmRaw: Candle[] = useMemo(
		() => (hdwmResp as any)?.data ?? hdwmResp ?? [],
		[hdwmResp],
	);

	// ── Refs
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<any> | null>(null);
	const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
	const emaSeriesRef = useRef<Record<string, ISeriesApi<any>>>({});
	const priceLinesRef = useRef<IPriceLine[]>([]);
	const pivotLinesRef = useRef<IPriceLine[]>([]);
	const liveCandleRef = useRef<LocalCandle | null>(null);
	const livePriceRef = useRef<number | null>(null);
	const historyRef = useRef<Candle[]>([]);
	const lastUiPricePushRef = useRef(0);
	const zoneCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const zoneSignalRef = useRef<typeof liveSignal | null>(null);

	// Keep historyRef in sync
	useEffect(() => {
		historyRef.current = candles;
	}, [candles]);

	// ── Indicators (with live price patched in)
	const indicators = useMemo(() => {
		if (!candles.length) return null;
		const withLive =
			livePriceSnapshot != null && candles.length > 0
				? [
						...candles.slice(0, -1),
						{
							...candles[candles.length - 1],
							close: livePriceSnapshot,
						},
					]
				: candles;
		return computeAll(withLive);
	}, [candles, livePriceSnapshot]);

	// ── HDWM frames
	const hdwmFrames = useMemo(() => {
		if (!hdwmRaw.length)
			return [] as Array<
				(typeof HDWM_FRAME_CONFIG)[number] & {
					data: HdwmFrameData;
				}
			>;
		return HDWM_FRAME_CONFIG.flatMap((cfg) => {
			const agg = aggregateHdwmCandles(hdwmRaw, cfg.hours);
			const data = buildHdwmFrameData(agg);
			return data ? [{ ...cfg, data }] : [];
		});
	}, [hdwmRaw]);

	const hdwmFrameMap = useMemo(() => {
		const m: Record<string, HdwmFrameData> = {};
		for (const f of hdwmFrames) m[f.key] = f.data;
		return m;
	}, [hdwmFrames]);

	// ── TradingView derived values
	const tradingViewSymbol = useMemo(
		() =>
			TRADINGVIEW_SYMBOL_MAP[currentSymbol] ??
			currentSymbol.replace('/', ''),
		[currentSymbol],
	);
	const tradingViewInterval = useMemo(
		() => toTradingViewInterval(currentTimeframe),
		[currentTimeframe],
	);
	// s.tradingview.com/widgetembed/ is the iframe-safe widget endpoint
	// (www.tradingview.com sets X-Frame-Options: deny)
	const tradingViewIframeSrc = useMemo(
		() =>
			`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tradingViewSymbol)}&interval=${tradingViewInterval}&theme=dark&style=1&locale=en&hidesidetoolbar=0&withdateranges=1&hide_top_toolbar=0&saveimage=1`,
		[tradingViewSymbol, tradingViewInterval],
	);

	// ── Derived price display
	const fallbackPrice =
		liveCandleSnapshot?.close ?? candles[candles.length - 1]?.close;
	const displayPrice = livePriceSnapshot ?? fallbackPrice;
	const prevClose =
		candles.length > 1
			? candles[candles.length - 2]?.close
			: undefined;
	const changeValue =
		displayPrice != null && prevClose != null
			? displayPrice - prevClose
			: 0;
	const changePercent = prevClose ? (changeValue / prevClose) * 100 : 0;
	const tvTickAgeMs = tvLastTickTs
		? Math.max(0, tvNowTs - tvLastTickTs)
		: null;

	const ohlc = useMemo(() => {
		if (liveCandleSnapshot)
			return {
				open: liveCandleSnapshot.open,
				high: liveCandleSnapshot.high,
				low: liveCandleSnapshot.low,
				close: liveCandleSnapshot.close,
			};
		if (!candles.length) return null;
		const last = candles[candles.length - 1];
		const c = livePriceSnapshot ?? last.close;
		return {
			open: last.open,
			high: livePriceSnapshot
				? Math.max(last.high, livePriceSnapshot)
				: last.high,
			low: livePriceSnapshot
				? Math.min(last.low, livePriceSnapshot)
				: last.low,
			close: c,
		};
	}, [candles, livePriceSnapshot, liveCandleSnapshot]);

	// ── Countdown
	const timeframeSeconds = useMemo(
		() => Math.max(1, timeframeToSeconds(currentTimeframe)),
		[currentTimeframe],
	);
	const countdownUrgent = Math.max(
		5,
		Math.min(20, Math.floor(timeframeSeconds * 0.08)),
	);
	const countdownWarning = Math.max(
		countdownUrgent + 5,
		Math.min(90, Math.floor(timeframeSeconds * 0.2)),
	);
	const countdownTone =
		countdownSecondsLeft <= countdownUrgent
			? 'urgent'
			: countdownSecondsLeft <= countdownWarning
				? 'warn'
				: 'ok';

	useEffect(() => {
		const tick = () => {
			const bucketSec = Math.max(
				1,
				timeframeToSeconds(currentTimeframe),
			);
			const nowSec = Date.now() / 1000;
			const latest = liveCandleRef.current?.time;
			let nextClose: number;
			if (
				latest &&
				Number.isFinite(latest) &&
				latest <= nowSec + bucketSec
			) {
				const bars = Math.max(
					0,
					Math.floor((nowSec - latest) / bucketSec),
				);
				nextClose = latest + (bars + 1) * bucketSec;
			} else {
				nextClose = Math.ceil(nowSec / bucketSec) * bucketSec;
			}
			let secs = Math.max(0, Math.ceil(nextClose - nowSec));
			if (secs <= 0 || secs > bucketSec)
				secs =
					bucketSec - (Math.floor(nowSec) % bucketSec) ||
					bucketSec;
			const h = Math.floor(secs / 3600),
				m = Math.floor((secs % 3600) / 60),
				s = secs % 60;
			setCountdownSecondsLeft(secs);
			if (h > 0)
				setCountdown(
					`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
				);
			else
				setCountdown(
					`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
				);
		};
		tick();
		const id = setInterval(tick, 250);
		return () => clearInterval(id);
	}, [currentTimeframe]);

	// ── RAF loop for TradingView tick freshness
	useEffect(() => {
		let raf: number;
		const loop = () => {
			setTvNowTs(Date.now());
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, []);

	// ── TradingView pivot overlay
	const tradingViewPivotOverlay = useMemo(() => {
		const recentCandles = candles.slice(-80);
		const allPrices: number[] = recentCandles.flatMap((c) => [
			c.high,
			c.low,
		]);
		if (displayPrice != null) allPrices.push(displayPrice);

		const pp = indicators?.pivotPoints;
		const vwap = indicators?.vwap;
		const vp = indicators?.volumeProfile;
		if (pp)
			Object.values(pp)
				.filter(Number.isFinite)
				.forEach((v) => allPrices.push(v as number));
		if (Number.isFinite(vwap) && vwap) allPrices.push(vwap);
		for (const cfg of HDWM_FRAME_CONFIG) {
			const f = hdwmFrameMap[cfg.key];
			if (f)
				[f.pivot, f.r1, f.s1].forEach(
					(v) => Number.isFinite(v) && allPrices.push(v),
				);
		}

		const valid = allPrices.filter(Number.isFinite);
		if (!valid.length) return { lines: [] as TvOverlayLine[] };

		const yMin = Math.min(...valid),
			yMax = Math.max(...valid),
			span = yMax - yMin || 1;

		const raw: Array<Omit<TvOverlayLine, 'yPct'>> = [];
		if (pp) {
			if (pp.r3)
				raw.push({
					id: 'r3',
					label: 'R3',
					price: pp.r3,
					color: '#ef4444',
				});
			if (pp.r2)
				raw.push({
					id: 'r2',
					label: 'R2',
					price: pp.r2,
					color: '#ef4444',
				});
			if (pp.r1)
				raw.push({
					id: 'r1',
					label: 'R1',
					price: pp.r1,
					color: '#f87171',
				});
			if (pp.pivot)
				raw.push({
					id: 'pivot',
					label: 'PIVOT',
					price: pp.pivot,
					color: '#f59e0b',
					emphasis: true,
				});
			if (pp.s1)
				raw.push({
					id: 's1',
					label: 'S1',
					price: pp.s1,
					color: '#34d399',
				});
			if (pp.s2)
				raw.push({
					id: 's2',
					label: 'S2',
					price: pp.s2,
					color: '#10b981',
				});
			if (pp.s3)
				raw.push({
					id: 's3',
					label: 'S3',
					price: pp.s3,
					color: '#059669',
				});
		}
		if (Number.isFinite(vwap) && vwap)
			raw.push({
				id: 'vwap',
				label: 'VWAP',
				price: vwap,
				color: '#2962ff',
				emphasis: true,
			});
		if (vp?.poc)
			raw.push({
				id: 'poc',
				label: 'POC',
				price: vp.poc,
				color: '#7c3aed',
				emphasis: true,
			});
		if (vp?.vah)
			raw.push({
				id: 'vah',
				label: 'VAH',
				price: vp.vah,
				color: '#a855f7',
			});
		if (vp?.val)
			raw.push({
				id: 'val',
				label: 'VAL',
				price: vp.val,
				color: '#a855f7',
			});
		for (const cfg of HDWM_FRAME_CONFIG) {
			const f = hdwmFrameMap[cfg.key];
			if (!f) continue;
			raw.push({
				id: `hdwm-${cfg.key}-pivot`,
				label: `${cfg.title} P`,
				price: f.pivot,
				color: cfg.color,
				emphasis: true,
			});
			raw.push({
				id: `hdwm-${cfg.key}-r1`,
				label: `${cfg.title} R1`,
				price: f.r1,
				color: cfg.color,
			});
			raw.push({
				id: `hdwm-${cfg.key}-s1`,
				label: `${cfg.title} S1`,
				price: f.s1,
				color: cfg.color,
			});
		}
		const plan = liveSignal?.plan;
		if (plan && liveSignal?.side !== 'HOLD') {
			if (plan.tp)
				raw.push({
					id: 'tp-trade',
					label: 'TP',
					price: plan.tp,
					color: '#00e676',
					emphasis: true,
				});
			if (plan.sl)
				raw.push({
					id: 'sl-trade',
					label: 'SL',
					price: plan.sl,
					color: '#ff5252',
					emphasis: true,
				});
		}

		const lines: TvOverlayLine[] = raw
			.filter((l) => Number.isFinite(l.price))
			.map((l) => ({ ...l, yPct: ((yMax - l.price) / span) * 100 }))
			.filter((l) => l.yPct >= -1 && l.yPct <= 101)
			.sort((a, b) => a.yPct - b.yPct);

		return { lines };
	}, [candles, indicators, displayPrice, hdwmFrameMap, liveSignal]);

	const tradingViewLevelChoices = useMemo(() => {
		const map = new Map(
			tradingViewPivotOverlay.lines.map((l) => [l.id, l]),
		);
		const ordered = TV_LEVEL_ORDER.flatMap((id) => {
			const l = map.get(id);
			return l ? [l] : [];
		});
		const usedIds = new Set(ordered.map((l) => l.id));
		return [
			...ordered,
			...tradingViewPivotOverlay.lines.filter(
				(l) => !usedIds.has(l.id),
			),
		];
	}, [tradingViewPivotOverlay.lines]);

	const visibleTvLines = useMemo(
		() =>
			tradingViewPivotOverlay.lines.filter(
				(l) => tvLevelSelection[l.id] !== false,
			),
		[tradingViewPivotOverlay.lines, tvLevelSelection],
	);

	// ── Zone canvas (SMC: OB / FVG / Breaker)
	const drawZoneCanvas = useCallback(() => {
		const canvas = zoneCanvasRef.current;
		const cs = seriesRef.current;
		const chart = chartRef.current;
		const cont = chartContainerRef.current;
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

		const SCALE_W = 72,
			chartW = w - SCALE_W;
		const py = (p: number): number | null => {
			if (!p || !Number.isFinite(p)) return null;
			const c = cs.priceToCoordinate(p);
			return c == null
				? null
				: Math.max(0, Math.min(h, c as number));
		};
		const tx = (ms: number) => {
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
				ctx.font = 'bold 11px ui-monospace,monospace';
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

	// ── Init chart (once)
	useEffect(() => {
		if (!chartContainerRef.current) return;
		const chart = createChart(chartContainerRef.current, {
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
			crosshair: {
				mode: CrosshairMode.Normal,
				vertLine: {
					color: 'rgba(200,160,60,0.4)',
					width: 1,
					style: 2,
				},
				horzLine: {
					color: 'rgba(200,160,60,0.4)',
					width: 1,
					style: 2,
				},
			},
			rightPriceScale: { borderColor: 'rgba(180,120,30,0.20)' },
			timeScale: {
				borderColor: 'rgba(180,120,30,0.20)',
				timeVisible: true,
				secondsVisible: false,
			},
			localization: {
				priceFormatter: (v: number) =>
					formatAxisPrice(currentSymbol, v),
			},
		});

		const cs = chart.addSeries(CandlestickSeries, {
			upColor: '#10b981',
			downColor: '#f43f5e',
			borderUpColor: '#10b981',
			borderDownColor: '#f43f5e',
			wickUpColor: '#10b981',
			wickDownColor: '#f43f5e',
			priceFormat: getPriceFormatOptions(currentSymbol),
		});
		const vs = chart.addSeries(HistogramSeries, {
			priceFormat: { type: 'volume' },
			priceScaleId: 'volume',
		});
		chart
			.priceScale('volume')
			.applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

		const emaColors = {
			ema9: '#f97316',
			ema21: '#64748b',
			ema50: '#8b5cf6',
			ema200: '#0ea5e9',
		};
		const emas: Record<string, ISeriesApi<any>> = {};
		for (const [name, color] of Object.entries(emaColors)) {
			emas[name] = chart.addSeries(LineSeries, {
				color,
				lineWidth: 1,
				crosshairMarkerVisible: false,
				priceLineVisible: false,
				lastValueVisible: false,
			});
		}

		chartRef.current = chart;
		seriesRef.current = cs;
		volumeSeriesRef.current = vs;
		emaSeriesRef.current = emas;
		liveCandleRef.current = null;

		chart
			.timeScale()
			.subscribeVisibleLogicalRangeChange(drawZoneCanvas);
		const ro = new ResizeObserver(drawZoneCanvas);
		if (chartContainerRef.current)
			ro.observe(chartContainerRef.current);

		return () => {
			ro.disconnect();
			chart
				.timeScale()
				.unsubscribeVisibleLogicalRangeChange(drawZoneCanvas);
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
			volumeSeriesRef.current = null;
			emaSeriesRef.current = {};
			priceLinesRef.current = [];
			pivotLinesRef.current = [];
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ── Update chart options on symbol change
	useEffect(() => {
		const chart = chartRef.current;
		if (!chart) return;
		chart.applyOptions({
			localization: {
				priceFormatter: (v: number) =>
					formatAxisPrice(currentSymbol, v),
			},
			timeScale: { secondsVisible: currentTimeframe.endsWith('s') },
		});
		seriesRef.current?.applyOptions({
			priceFormat: getPriceFormatOptions(currentSymbol),
		});
	}, [currentSymbol, currentTimeframe]);

	// ── TradingView: script injection removed — s3.tradingview.com CDN is unreachable
	// Always use the iframe path (s.tradingview.com/widgetembed/ is iframe-safe)

	// ── Reset on symbol/timeframe change
	useEffect(() => {
		liveCandleRef.current = null;
		livePriceRef.current = null;
		lastUiPricePushRef.current = 0;
		setLivePriceSnapshot(undefined);
		setLiveCandleSnapshot(null);
		setTvLastTickTs(null);
		zoneSignalRef.current = null;
	}, [currentSymbol, currentTimeframe]);

	// ── Load history → chart
	useEffect(() => {
		const cs = seriesRef.current,
			vs = volumeSeriesRef.current;
		if (!cs || !vs) return;
		cs.setData([]);
		vs.setData([]);
		for (const s of Object.values(emaSeriesRef.current)) s.setData([]);
		liveCandleRef.current = null;
		if (!candles.length) return;

		const sorted = [...candles].sort(
			(a, b) => Number(a.time) - Number(b.time),
		);
		const lwC = sorted.map((c) => ({
			time: (Number(c.time) / 1000) as any,
			open: c.open,
			high: c.high,
			low: c.low,
			close: c.close,
		}));
		const lwV = sorted.map((c) => ({
			time: (Number(c.time) / 1000) as any,
			value: c.volume ?? 0,
			color:
				c.close >= c.open
					? 'rgba(16,185,129,0.35)'
					: 'rgba(244,63,94,0.35)',
		}));
		cs.setData(lwC);
		vs.setData(lwV);

		const last = sorted[sorted.length - 1];
		const seeded: LocalCandle = {
			time: Math.floor(Number(last.time) / 1000),
			open: last.open,
			high: last.high,
			low: last.low,
			close: last.close,
			volume: last.volume ?? 0,
		};
		liveCandleRef.current = seeded;
		setLiveCandleSnapshot(seeded);
		chartRef.current?.timeScale().fitContent();
	}, [candles]);

	// ── Update EMA overlays
	useEffect(() => {
		const emas = emaSeriesRef.current;
		if (
			!indicators?.emaArrays ||
			!Object.keys(emas).length ||
			!candles.length
		)
			return;
		const timeMap = candles.map((c) =>
			Math.floor(Number(c.time) / 1000),
		);
		for (const [name, arr] of Object.entries(
			indicators.emaArrays,
		) as Array<[string, number[] | null]>) {
			const series = emas[name];
			if (!series || !arr) continue;
			const offset = candles.length - arr.length;
			if (offset < 0) continue;
			const seen = new Set<number>();
			const data: { time: any; value: number }[] = [];
			for (let i = 0; i < arr.length; i++) {
				const t = timeMap[i + offset];
				if (t && !seen.has(t)) {
					seen.add(t);
					data.push({ time: t, value: arr[i] });
				}
			}
			try {
				series.setData(data.sort((a, b) => a.time - b.time));
			} catch {
				/* silent */
			}
		}
	}, [indicators, candles]);

	// ── Apply live price to chart
	const applyLivePriceToChart = useCallback(
		(price: number, timestampMs?: number) => {
			const cs = seriesRef.current,
				vs = volumeSeriesRef.current;
			if (!cs || !Number.isFinite(price) || price <= 0) return;
			const bucketSec = timeframeToSeconds(currentTimeframe);
			const eventSec = Math.floor(
				normalizeTimestampMs(timestampMs) / 1000,
			);
			const bucket = Math.floor(eventSec / bucketSec) * bucketSec;
			const current = liveCandleRef.current;
			if (!current) return;
			const next: LocalCandle =
				bucket > current.time
					? {
							time: bucket,
							open: current.close,
							high: Math.max(current.close, price),
							low: Math.min(current.close, price),
							close: price,
							volume: 0,
						}
					: {
							...current,
							high: Math.max(current.high, price),
							low: Math.min(current.low, price),
							close: price,
						};
			liveCandleRef.current = next;
			try {
				cs.update({
					time: next.time as any,
					open: next.open,
					high: next.high,
					low: next.low,
					close: next.close,
				});
				vs?.update({
					time: next.time as any,
					value: next.volume,
					color:
						next.close >= next.open
							? 'rgba(16,185,129,0.35)'
							: 'rgba(244,63,94,0.35)',
				});
			} catch {
				/* silent */
			}
		},
		[currentTimeframe],
	);

	// ── Live tick subscription (liveTickBus — no React overhead on hot path)
	useEffect(() => {
		const unsub = subscribeLiveTick(currentSymbol, (tick) => {
			const price = Number(tick.price);
			if (!Number.isFinite(price) || price <= 0) return;
			const tickTsMs = normalizeTimestampMs(tick.timestamp);
			livePriceRef.current = price;
			applyLivePriceToChart(price, tickTsMs);
			setTvLastTickTs(tickTsMs);
			const now = Date.now();
			if (
				chartProvider === 'tradingview' ||
				now - lastUiPricePushRef.current >= 120
			) {
				if (chartProvider !== 'tradingview')
					lastUiPricePushRef.current = now;
				setLivePriceSnapshot(price);
				if (liveCandleRef.current)
					setLiveCandleSnapshot({ ...liveCandleRef.current });
			}
		});
		return unsub;
	}, [
		currentSymbol,
		currentTimeframe,
		applyLivePriceToChart,
		chartProvider,
	]);

	// ── Pivot price lines (Scaly chart only)
	useEffect(() => {
		const cs = seriesRef.current;
		if (!cs) return;
		pivotLinesRef.current.forEach((l) => cs.removePriceLine(l));
		pivotLinesRef.current = [];
		if (!showPivotLevels || chartProvider !== 'scaly') return;
		const pp = indicators?.pivotPoints;
		const vwap = Number(indicators?.vwap);
		const vp = indicators?.volumeProfile;
		const defs = [
			{
				price: pp?.r3,
				color: '#ef4444',
				title: 'R3',
				style: 2,
				w: 1,
			},
			{
				price: pp?.r2,
				color: '#ef4444',
				title: 'R2',
				style: 1,
				w: 1,
			},
			{
				price: pp?.r1,
				color: '#f87171',
				title: 'R1',
				style: 1,
				w: 1,
			},
			{
				price: pp?.pivot,
				color: '#f59e0b',
				title: 'PIVOT',
				style: 0,
				w: 2,
			},
			{
				price: vwap,
				color: '#2962ff',
				title: 'VWAP',
				style: 0,
				w: 2,
			},
			{
				price: vp?.poc,
				color: '#7c3aed',
				title: 'POC',
				style: 0,
				w: 2,
			},
			{
				price: vp?.vah,
				color: '#a855f7',
				title: 'VAH',
				style: 2,
				w: 1,
			},
			{
				price: vp?.val,
				color: '#a855f7',
				title: 'VAL',
				style: 2,
				w: 1,
			},
			{
				price: pp?.s1,
				color: '#34d399',
				title: 'S1',
				style: 1,
				w: 1,
			},
			{
				price: pp?.s2,
				color: '#10b981',
				title: 'S2',
				style: 1,
				w: 1,
			},
			{
				price: pp?.s3,
				color: '#059669',
				title: 'S3',
				style: 2,
				w: 1,
			},
		];
		pivotLinesRef.current = defs
			.filter((d) => Number.isFinite(Number(d.price)))
			.map((d) =>
				cs.createPriceLine({
					price: Number(d.price),
					color: d.color,
					lineWidth: d.w as 1 | 2,
					lineStyle: d.style,
					axisLabelVisible: true,
					title: d.title,
				}),
			);
	}, [
		indicators,
		showPivotLevels,
		chartProvider,
		currentSymbol,
		currentTimeframe,
	]);

	// ── Trade level price lines (Entry / TP / SL)
	useEffect(() => {
		const cs = seriesRef.current;
		if (!cs) return;
		priceLinesRef.current.forEach((l) => cs.removePriceLine(l));
		priceLinesRef.current = [];
		if (
			!showTradeLevels ||
			!liveSignal?.plan ||
			liveSignal.side === 'HOLD'
		)
			return;
		const { entry, tp, sl } = liveSignal.plan;
		const lines: IPriceLine[] = [];
		if (entry)
			lines.push(
				cs.createPriceLine({
					price: entry,
					color: '#f5b041',
					lineWidth: 2,
					lineStyle: 2,
					axisLabelVisible: true,
					title: 'ENTRY',
				}),
			);
		if (tp)
			lines.push(
				cs.createPriceLine({
					price: tp,
					color: '#00e676',
					lineWidth: 2,
					lineStyle: 0,
					axisLabelVisible: true,
					title: 'TP',
				}),
			);
		if (sl)
			lines.push(
				cs.createPriceLine({
					price: sl,
					color: '#ff5252',
					lineWidth: 2,
					lineStyle: 0,
					axisLabelVisible: true,
					title: 'SL',
				}),
			);
		priceLinesRef.current = lines;
	}, [liveSignal, showTradeLevels, currentSymbol, currentTimeframe]);

	// ── Zone canvas update
	useEffect(() => {
		zoneSignalRef.current = liveSignal ?? null;
		drawZoneCanvas();
	}, [liveSignal, drawZoneCanvas]);

	// ── Handlers
	const toggleTvLevel = (id: string) =>
		setTvLevelSelection((p) => ({
			...p,
			[id]: p[id] !== false ? false : true,
		}));
	const setAllTvLevels = (v: boolean) =>
		setTvLevelSelection((p) => {
			const n = { ...p };
			for (const l of tradingViewPivotOverlay.lines) n[l.id] = v;
			return n;
		});
	const zoomTradingView = (dir: 'in' | 'out') => {
		const order = [...TRADINGVIEW_ZOOM_TIMEFRAMES];
		let idx = order.indexOf(currentTimeframe as any);
		if (idx < 0) idx = 0;
		const next =
			order[
				dir === 'in'
					? Math.max(0, idx - 1)
					: Math.min(order.length - 1, idx + 1)
			];
		if (next && next !== currentTimeframe)
			setCurrentTimeframe(next as TimeframeType);
	};

	// ─── JSX ──────────────────────────────────────────────────────────────────
	return (
		<Card className="w-full card-accent-top overflow-hidden">
			<CardHeader className="pb-1 pt-3 px-4 space-y-1.5">
				{/* ── Title row */}
				<CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 glow-pulse shrink-0" />
					{t('dashboard.chart')}
					<span className="text-xs text-muted-foreground font-mono">
						{currentSymbol} · {currentTimeframe}
					</span>

					{/* Countdown chip */}
					<span
						className={`ml-auto font-mono text-xs px-1.5 py-0.5 rounded border ${
							countdownTone === 'urgent'
								? 'border-red-500/50 text-red-400 bg-red-500/10'
								: countdownTone === 'warn'
									? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
									: 'border-slate-600/40 text-slate-400'
						}`}
					>
						{formatTimeframeLabel(currentTimeframe)} ·{' '}
						{countdown}
					</span>

					{/* Live signal badge */}
					{liveSignal?.plan &&
						liveSignal.side &&
						liveSignal.side !== 'HOLD' &&
						(() => {
							const { plan, side } = liveSignal;
							const buy = side === 'BUY';
							return (
								<span
									className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded border ${buy ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' : 'text-rose-400 bg-rose-400/10 border-rose-400/30'}`}
								>
									<span
										className={`font-bold ${buy ? 'text-emerald-400' : 'text-rose-400'}`}
									>
										{side}
									</span>
									<span>
										@{' '}
										{formatPrice(
											currentSymbol,
											plan.entry,
										)}
									</span>
									<span className="text-emerald-400">
										TP{' '}
										{formatPrice(
											currentSymbol,
											plan.tp,
										)}
									</span>
									<span className="text-rose-400">
										SL{' '}
										{formatPrice(
											currentSymbol,
											plan.sl,
										)}
									</span>
									{plan.rr && (
										<span className="text-amber-400">
											{plan.rr.toFixed(1)}R
										</span>
									)}
								</span>
							);
						})()}
				</CardTitle>

				{/* ── Price + OHLC */}
				<div className="flex items-center gap-3 flex-wrap">
					<span className="text-base font-bold font-mono tracking-tight">
						{formatPrice(currentSymbol, displayPrice)}
					</span>
					<span
						className={`text-xs font-mono ${changeValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
					>
						{formatChange(currentSymbol, changeValue)} (
						{changeValue >= 0 ? '+' : ''}
						{changePercent.toFixed(2)}%)
					</span>
					{ohlc && (
						<span className="flex gap-2 text-[11px] font-mono text-muted-foreground ml-auto">
							<span>
								O {formatPrice(currentSymbol, ohlc.open)}
							</span>
							<span>
								H {formatPrice(currentSymbol, ohlc.high)}
							</span>
							<span>
								L {formatPrice(currentSymbol, ohlc.low)}
							</span>
							<span>
								C {formatPrice(currentSymbol, ohlc.close)}
							</span>
						</span>
					)}
				</div>

				{/* ── Provider toggles */}
				<div className="flex items-center gap-1.5 flex-wrap">
					<button
						onClick={() => setChartProvider('scaly')}
						className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${chartProvider === 'scaly' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
					>
						Scaly Chart
					</button>
					<button
						onClick={() => setChartProvider('tradingview')}
						className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${chartProvider === 'tradingview' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
					>
						TradingView
					</button>
					<div className="w-px h-4 bg-slate-700 mx-0.5" />
					<button
						onClick={() => setShowTradeLevels((v) => !v)}
						className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${showTradeLevels ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
					>
						Trade Lines
					</button>
					<button
						onClick={() => setShowPivotLevels((v) => !v)}
						className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${showPivotLevels ? 'bg-purple-500/15 border-purple-500/40 text-purple-400' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
					>
						Pivots
					</button>
					{chartProvider === 'tradingview' && (
						<button
							onClick={() => setShowHdwmTable((v) => !v)}
							className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${showHdwmTable ? 'bg-slate-600/40 border-slate-500 text-slate-300' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
						>
							HDWM Table
						</button>
					)}
				</div>

				{/* ── TradingView controls */}
				{chartProvider === 'tradingview' && (
					<div className="flex items-center gap-2 flex-wrap text-[11px]">
						<span className="font-mono text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700">
							{tradingViewSymbol}
						</span>
						<span
							className={`font-mono px-1.5 py-0.5 rounded border ${tvTickAgeMs != null && tvTickAgeMs <= LIVE_TICK_FRESH_MS ? 'border-emerald-700/50 text-emerald-400 bg-emerald-900/20' : 'border-slate-600/50 text-slate-500'}`}
						>
							{formatPrice(currentSymbol, displayPrice)} ·{' '}
							{formatClockWithMs(tvLastTickTs)} ·{' '}
							{tvTickAgeMs != null
								? `${tvTickAgeMs}ms`
								: '—'}
						</span>
						<button
							onClick={() => zoomTradingView('in')}
							className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 hover:border-slate-500"
						>
							Zoom +
						</button>
						<button
							onClick={() => zoomTradingView('out')}
							className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 hover:border-slate-500"
						>
							Zoom −
						</button>

						{currentTimeframe.endsWith('s') && (
							<span className="text-amber-400/80">
								Secondes non garanties sur TV, fallback 1m.
							</span>
						)}
					</div>
				)}

				{/* ── Level checkboxes (TV + pivots ON) */}
				{chartProvider === 'tradingview' &&
					showPivotLevels &&
					tradingViewLevelChoices.length > 0 && (
						<div className="flex items-center gap-1 flex-wrap pt-0.5">
							<button
								onClick={() => setAllTvLevels(true)}
								className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px] hover:border-slate-500"
							>
								All
							</button>
							<button
								onClick={() => setAllTvLevels(false)}
								className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px] hover:border-slate-500"
							>
								None
							</button>
							{tradingViewLevelChoices.map((line) => {
								const active =
									tvLevelSelection[line.id] !== false;
								return (
									<button
										key={line.id}
										onClick={() =>
											toggleTvLevel(line.id)
										}
										title={`${line.label} ${formatPrice(currentSymbol, line.price)}`}
										className="px-1.5 py-0.5 rounded border text-[10px] font-mono transition-colors"
										style={
											{
												borderColor: line.color,
												color: active
													? '#fff'
													: line.color,
												background: active
													? `${line.color}22`
													: undefined,
											} as CSSProperties
										}
									>
										{line.label}{' '}
										{formatPrice(
											currentSymbol,
											line.price,
										)}
									</button>
								);
							})}
						</div>
					)}

				{/* ── Timeframe buttons */}
				<div className="flex items-center gap-1 flex-wrap">
					{FAST_TIMEFRAMES.map((tf) => (
						<button
							key={tf}
							onClick={() => setCurrentTimeframe(tf)}
							className={`px-1.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${tf === currentTimeframe ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 font-semibold' : 'border-slate-700/60 text-slate-500 hover:border-slate-500 hover:text-slate-400'}`}
						>
							{tf.toUpperCase()}
						</button>
					))}
					<div className="w-px h-4 bg-slate-700 mx-0.5" />
					{STANDARD_TIMEFRAMES.map((tf) => (
						<button
							key={tf}
							onClick={() => setCurrentTimeframe(tf)}
							className={`px-1.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${tf === currentTimeframe ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 font-semibold' : 'border-slate-700/60 text-slate-500 hover:border-slate-500 hover:text-slate-400'}`}
						>
							{formatTimeframeLabel(tf)}
						</button>
					))}
				</div>
			</CardHeader>

			<CardContent className="p-0 pb-1 px-1">
				{/* ── Chart stage */}
				<div className="relative w-full" style={{ height: 500 }}>
					{/* Scaly lightweight-charts pane */}
					<div
						ref={chartContainerRef}
						className={`absolute inset-0 ${chartProvider === 'scaly' ? '' : 'invisible pointer-events-none'}`}
					>
						<canvas
							ref={zoneCanvasRef}
							className="absolute inset-0 pointer-events-none"
							style={{ zIndex: 10 }}
						/>
					</div>

					{/* TradingView pane */}
					<div
						className={`absolute inset-0 overflow-hidden ${chartProvider === 'tradingview' ? '' : 'invisible pointer-events-none'}`}
					>
						<iframe
							title="TradingView Chart"
							src={tradingViewIframeSrc}
							className="w-full h-full border-0"
							allowFullScreen
							referrerPolicy="origin"
							onLoad={() => setTvIframeLoaded(true)}
						/>
						{!tvIframeLoaded && (
							<div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
								Chargement TradingView…{' '}
								<a
									href={tradingViewIframeSrc}
									target="_blank"
									rel="noreferrer"
									className="underline ml-1 text-blue-400"
								>
									Ouvrir
								</a>
							</div>
						)}

						{/* Pivot overlay (absolute lines) */}
						{showPivotLevels && visibleTvLines.length > 0 && (
							<div
								className="absolute inset-0 pointer-events-none overflow-hidden"
								style={{ zIndex: 20 }}
							>
								{visibleTvLines.map((line) => (
									<div
										key={line.id}
										className="absolute w-full"
										style={
											{
												top: `${line.yPct}%`,
												borderTop: `1px solid ${line.color}`,
												opacity: line.emphasis
													? 1
													: 0.65,
											} as CSSProperties
										}
									>
										<span
											className="absolute right-0 text-[9px] font-mono px-1 py-px rounded-bl"
											style={
												{
													color: line.color,
													background:
														'rgba(0,0,0,0.55)',
													border: `1px solid ${line.color}55`,
												} as CSSProperties
											}
										>
											{line.label}{' '}
											{formatPrice(
												currentSymbol,
												line.price,
											)}
										</span>
									</div>
								))}
							</div>
						)}

						{/* HDWM overlay table */}
						{showHdwmTable && (
							<div className="absolute top-2 left-2 z-30 max-h-72 overflow-auto rounded border border-slate-700 bg-slate-900/90 text-[11px] font-mono shadow-lg">
								<div className="px-2 py-1 text-slate-400 border-b border-slate-700 font-semibold">
									Institutional Pivots HDWM
								</div>
								{hdwmFrames.length === 0 ? (
									<div className="px-3 py-2 text-slate-500">
										Loading HDWM data…
									</div>
								) : (
									<table className="border-collapse">
										<thead>
											<tr>
												<th className="px-2 py-1 text-slate-500 text-left font-normal">
													Level
												</th>
												{HDWM_FRAME_CONFIG.map(
													(cfg) => (
														<th
															key={cfg.key}
															className="px-2 py-1 font-semibold text-right"
															style={{
																color: cfg.color,
															}}
														>
															{cfg.title}
														</th>
													),
												)}
											</tr>
										</thead>
										<tbody>
											{(
												[
													'pivot',
													'r1',
													'r2',
													's1',
													's2',
												] as const
											).map((key) => (
												<tr
													key={key}
													className="border-t border-slate-800"
												>
													<th className="px-2 py-0.5 text-slate-400 font-semibold text-left">
														{key.toUpperCase()}
													</th>
													{HDWM_FRAME_CONFIG.map(
														(cfg) => {
															const f =
																hdwmFrameMap[
																	cfg.key
																];
															return (
																<td
																	key={
																		cfg.key
																	}
																	className="px-2 py-0.5 text-right tabular-nums"
																	style={{
																		color: cfg.color,
																	}}
																>
																	{f
																		? formatPrice(
																				currentSymbol,
																				f[
																					key
																				],
																			)
																		: '—'}
																</td>
															);
														},
													)}
												</tr>
											))}
											<tr className="border-t border-slate-800">
												<th className="px-2 py-0.5 text-slate-400 font-normal text-left">
													Volat %
												</th>
												{HDWM_FRAME_CONFIG.map(
													(cfg) => {
														const f =
															hdwmFrameMap[
																cfg.key
															];
														return (
															<td
																key={
																	cfg.key
																}
																className="px-2 py-0.5 text-right tabular-nums text-slate-400"
															>
																{f
																	? `${f.fluctuationPct.toFixed(2)}%`
																	: '—'}
															</td>
														);
													},
												)}
											</tr>
										</tbody>
									</table>
								)}
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
