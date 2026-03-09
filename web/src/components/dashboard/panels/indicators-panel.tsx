import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { Candle } from '@/types/market';

function Row({
	label,
	value,
	color,
	badge,
}: {
	label: string;
	value: string | number | null;
	color?: string;
	badge?: { text: string; tone: 'buy' | 'sell' | 'neutral' | 'gold' };
}) {
	const badgeClass =
		badge?.tone === 'buy'
			? 'bg-buy/15 text-buy border-buy/30'
			: badge?.tone === 'sell'
				? 'bg-sell/15 text-sell border-sell/30'
				: badge?.tone === 'gold'
					? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
					: 'bg-muted text-muted-foreground border-border';

	return (
		<div className="flex justify-between items-center py-0.5">
			<span className="text-muted-foreground text-[11px]">
				{label}
			</span>
			<div className="flex items-center gap-1.5">
				{value != null && (
					<span
						className={`font-mono text-xs tabular-nums font-medium ${color ?? ''}`}
					>
						{value}
					</span>
				)}
				{badge && (
					<span
						className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${badgeClass}`}
					>
						{badge.text}
					</span>
				)}
			</div>
		</div>
	);
}

type SectionKey = 'trend' | 'momentum' | 'volatility' | 'volume';

const SECTION_META: Record<SectionKey, { label: string; accent: string }> =
	{
		trend: { label: 'Trend Engine', accent: '#22c55e' },
		momentum: { label: 'Momentum Suite', accent: '#f59e0b' },
		volatility: { label: 'Volatility Lab', accent: '#8b5cf6' },
		volume: { label: 'Volume Pressure', accent: '#06b6d4' },
	};

function Section({
	sectionKey,
	children,
}: {
	sectionKey: SectionKey;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(true);
	const { label, accent } = SECTION_META[sectionKey];

	return (
		<div>
			<button
				className="w-full flex items-center justify-between py-1 group"
				onClick={() => setOpen((v) => !v)}
			>
				<span
					className="text-[10px] font-bold uppercase tracking-wider"
					style={{ color: accent }}
				>
					{label}
				</span>
				{open ? (
					<ChevronUp
						className="h-3 w-3"
						style={{ color: accent }}
					/>
				) : (
					<ChevronDown className="h-3 w-3 opacity-50" />
				)}
			</button>
			{open && <div className="space-y-0">{children}</div>}
		</div>
	);
}

export function IndicatorsPanel() {
	const { t } = useTranslation();
	const { currentSymbol, currentTimeframe } = useMarket();
	const { data: historyResp } = useHistory(
		currentSymbol,
		currentTimeframe,
		200,
	);
	const candles: Candle[] = useMemo(
		() => (historyResp as any)?.data ?? historyResp ?? [],
		[historyResp],
	);
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

	const rsiColor = (v: number | null) =>
		v == null ? '' : v > 70 ? 'text-sell' : v < 30 ? 'text-buy' : '';

	const overallSignal = ind.proCombo?.direction ?? 'NEUTRAL';
	const overallScore = ind.proCombo?.score ?? 50;
	const overallColor =
		overallScore > 60
			? '#22c55e'
			: overallScore < 40
				? '#ef4444'
				: '#6b7280';

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Activity className="h-4 w-4" />
					{t('dashboard.indicators')}
					{/* Quick summary */}
					<span
						className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded border"
						style={{
							color: overallColor,
							borderColor: `${overallColor}44`,
							background: `${overallColor}12`,
						}}
					>
						{overallSignal} · {overallScore}
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-3 divide-y divide-border/40 space-y-0">
				<Section sectionKey="trend">
					<Row
						label="EMA 9 / 21"
						value={null}
						badge={
							ind.ema9 != null && ind.ema21 != null
								? {
										text:
											ind.ema9 > ind.ema21
												? 'BULL'
												: 'BEAR',
										tone:
											ind.ema9 > ind.ema21
												? 'buy'
												: 'sell',
									}
								: undefined
						}
					/>
					<Row
						label="EMA 9"
						value={ind.ema9?.toFixed(2) ?? null}
					/>
					<Row
						label="EMA 21"
						value={ind.ema21?.toFixed(2) ?? null}
					/>
					<Row
						label="EMA 50"
						value={ind.ema50?.toFixed(2) ?? null}
					/>
					<Row
						label="EMA 200"
						value={ind.ema200?.toFixed(2) ?? null}
					/>
					<Row
						label="ADX"
						value={ind.adx?.adx?.toFixed(1) ?? null}
						color={
							ind.adx?.adx != null
								? ind.adx.adx > 25
									? 'text-yellow-400'
									: ''
								: ''
						}
					/>
					<Row
						label={t('indicators.trend')}
						value={null}
						badge={
							ind.trend?.direction
								? {
										text: ind.trend.direction,
										tone:
											ind.trend.direction ===
											'BULLISH'
												? 'buy'
												: ind.trend.direction ===
													  'BEARISH'
													? 'sell'
													: 'neutral',
									}
								: undefined
						}
					/>
					<Row
						label="Ichimoku"
						value={null}
						badge={
							ind.ichimoku?.signal
								? {
										text: ind.ichimoku.signal,
										tone:
											ind.ichimoku.signal ===
											'BULLISH'
												? 'buy'
												: ind.ichimoku.signal ===
													  'BEARISH'
													? 'sell'
													: 'neutral',
									}
								: undefined
						}
					/>
				</Section>

				<Section sectionKey="momentum">
					<Row
						label="RSI(14)"
						value={ind.rsi?.toFixed(1) ?? null}
						color={rsiColor(ind.rsi ?? null)}
						badge={
							ind.rsi != null
								? ind.rsi > 70
									? { text: 'OB', tone: 'sell' }
									: ind.rsi < 30
										? { text: 'OS', tone: 'buy' }
										: undefined
								: undefined
						}
					/>
					<Row
						label="RSI Div."
						value={null}
						badge={
							ind.rsiDivergence?.signal
								? {
										text: ind.rsiDivergence.signal,
										tone:
											ind.rsiDivergence.signal ===
											'BULLISH'
												? 'buy'
												: ind.rsiDivergence
															.signal ===
													  'BEARISH'
													? 'sell'
													: 'neutral',
									}
								: undefined
						}
					/>
					<Row
						label="MACD"
						value={ind.macdLine?.toFixed(2) ?? null}
					/>
					<Row
						label="Signal"
						value={ind.macdSignal?.toFixed(2) ?? null}
					/>
					<Row
						label="Histogram"
						value={ind.macdHistogram?.toFixed(3) ?? null}
						color={
							ind.macdHistogram != null
								? ind.macdHistogram > 0
									? 'text-buy'
									: 'text-sell'
								: ''
						}
					/>
					<Row
						label="Stoch %K/%D"
						value={
							ind.stochastic?.k != null &&
							ind.stochastic?.d != null
								? `${ind.stochastic.k.toFixed(1)} / ${ind.stochastic.d.toFixed(1)}`
								: null
						}
					/>
					<Row
						label="StochRSI"
						value={null}
						badge={
							ind.stochRsi?.signal
								? {
										text: ind.stochRsi.signal,
										tone:
											ind.stochRsi.signal ===
											'BULLISH'
												? 'buy'
												: ind.stochRsi.signal ===
													  'BEARISH'
													? 'sell'
													: 'neutral',
									}
								: undefined
						}
					/>
					<Row
						label="Williams %R"
						value={ind.williamsR?.toFixed(1) ?? null}
						color={
							ind.williamsR != null
								? ind.williamsR < -80
									? 'text-buy'
									: ind.williamsR > -20
										? 'text-sell'
										: ''
								: ''
						}
					/>
					<Row
						label="CCI"
						value={ind.cci?.toFixed(1) ?? null}
						color={
							ind.cci != null
								? ind.cci > 100
									? 'text-sell'
									: ind.cci < -100
										? 'text-buy'
										: ''
								: ''
						}
					/>
				</Section>

				<Section sectionKey="volatility">
					<Row
						label="BB Upper"
						value={ind.bbUpper?.toFixed(2) ?? null}
					/>
					<Row
						label="BB Middle"
						value={ind.bbMiddle?.toFixed(2) ?? null}
					/>
					<Row
						label="BB Lower"
						value={ind.bbLower?.toFixed(2) ?? null}
					/>
					<Row
						label="BB Width"
						value={
							ind.bbBandwidth != null
								? `${ind.bbBandwidth.toFixed(2)}%`
								: null
						}
					/>
					<Row
						label="BB Squeeze"
						value={null}
						badge={
							ind.bbSqueeze?.isSqueezing != null
								? {
										text: ind.bbSqueeze.isSqueezing
											? 'SQUEEZE'
											: 'OPEN',
										tone: ind.bbSqueeze.isSqueezing
											? 'gold'
											: 'neutral',
									}
								: undefined
						}
					/>
					<Row
						label="ATR(14)"
						value={ind.atr?.toFixed(2) ?? null}
					/>
					<Row
						label="Keltner U/L"
						value={
							ind.keltner?.upper != null &&
							ind.keltner?.lower != null
								? `${ind.keltner.upper.toFixed(2)} / ${ind.keltner.lower.toFixed(2)}`
								: null
						}
					/>
				</Section>

				<Section sectionKey="volume">
					<Row
						label="MFI"
						value={ind.mfi?.toFixed(1) ?? null}
						color={
							ind.mfi != null
								? ind.mfi > 80
									? 'text-sell'
									: ind.mfi < 20
										? 'text-buy'
										: ''
								: ''
						}
					/>
					<Row
						label="VWAP"
						value={ind.vwap?.toFixed(2) ?? null}
					/>
					<Row
						label="OBV Trend"
						value={null}
						badge={
							ind.obv?.trend
								? {
										text: ind.obv.trend,
										tone:
											ind.obv.trend === 'UP'
												? 'buy'
												: ind.obv.trend === 'DOWN'
													? 'sell'
													: 'neutral',
									}
								: undefined
						}
					/>
					<Row
						label="CVD Trend"
						value={null}
						badge={
							ind.cvd?.trend
								? {
										text: ind.cvd.trend,
										tone:
											ind.cvd.trend === 'UP'
												? 'buy'
												: ind.cvd.trend === 'DOWN'
													? 'sell'
													: 'neutral',
									}
								: undefined
						}
					/>
					<Row
						label="Vol. Profile"
						value={null}
						badge={
							ind.volumeProfile?.skew
								? {
										text: ind.volumeProfile.skew,
										tone:
											ind.volumeProfile.skew ===
											'BUY'
												? 'buy'
												: ind.volumeProfile
															.skew ===
													  'SELL'
													? 'sell'
													: 'neutral',
									}
								: undefined
						}
					/>
				</Section>
			</CardContent>
		</Card>
	);
}
