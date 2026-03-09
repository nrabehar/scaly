import { useMemo } from 'react';
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
import { Target } from 'lucide-react';
import type { Candle } from '@/types/market';

/** SVG semicircle gauge with needle — score 0–100 */
function NeedleGauge({ score, color }: { score: number; color: string }) {
	const cx = 96,
		cy = 96,
		r = 72;
	const arcLen = Math.PI * r; // half circle circumference
	const offset = arcLen - (score / 100) * arcLen;

	// Needle from center towards arc — angle mapped 180°→0° left to right
	const angleDeg = 180 - score * 1.8;
	const angleRad = (angleDeg * Math.PI) / 180;
	const nLen = 54;
	const nx = cx + nLen * Math.cos(angleRad);
	const ny = cy - nLen * Math.sin(angleRad);

	const gaugePath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

	return (
		<svg
			viewBox="0 0 192 110"
			className="w-full"
			style={{ maxHeight: 110 }}
		>
			<defs>
				<linearGradient
					id="gTrack"
					x1="0%"
					y1="0%"
					x2="100%"
					y2="0%"
				>
					<stop
						offset="0%"
						stopColor="#ef4444"
						stopOpacity={0.35}
					/>
					<stop
						offset="50%"
						stopColor="#6b7280"
						stopOpacity={0.25}
					/>
					<stop
						offset="100%"
						stopColor="#22c55e"
						stopOpacity={0.35}
					/>
				</linearGradient>
			</defs>
			{/* Track */}
			<path
				d={gaugePath}
				fill="none"
				stroke="url(#gTrack)"
				strokeWidth={10}
			/>
			{/* Progress */}
			<path
				d={gaugePath}
				fill="none"
				stroke={color}
				strokeWidth={10}
				strokeDasharray={arcLen}
				strokeDashoffset={offset}
				strokeLinecap="round"
				style={{
					transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s',
				}}
			/>
			{/* Glow */}
			<path
				d={gaugePath}
				fill="none"
				stroke={color}
				strokeWidth={18}
				strokeDasharray={arcLen}
				strokeDashoffset={offset}
				strokeOpacity={0.12}
			/>
			{/* Needle */}
			<line
				x1={cx}
				y1={cy}
				x2={nx}
				y2={ny}
				stroke={color}
				strokeWidth={2.5}
				strokeLinecap="round"
				style={{ transition: 'all 0.5s ease' }}
			/>
			<circle
				cx={cx}
				cy={cy}
				r={7}
				fill="hsl(var(--card))"
				stroke={color}
				strokeWidth={2}
			/>
			<circle cx={cx} cy={cy} r={3} fill={color} />
			{/* Labels */}
			<text
				x={cx - r - 6}
				y={cy + 14}
				fontSize={9}
				fill="#ef4444"
				textAnchor="middle"
				fontWeight="700"
			>
				SELL
			</text>
			<text
				x={cx + r + 6}
				y={cy + 14}
				fontSize={9}
				fill="#22c55e"
				textAnchor="middle"
				fontWeight="700"
			>
				BUY
			</text>
		</svg>
	);
}

const BLOCK_LABELS: Record<string, string> = {
	trend: 'Trend',
	momentum: 'Momentum',
	volume: 'Volume',
	volatility: 'Volatility',
	structure: 'Structure',
	confirmation: 'MTF',
};

export function CompositeScorePanel() {
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

	const combo = ind?.proCombo;
	const score = combo?.score ?? 50; // 0–100
	const direction = combo?.direction ?? 'NEUTRAL';
	const blocks = combo?.blocks ?? {};

	const gaugeColor =
		score > 60 ? '#22c55e' : score < 40 ? '#ef4444' : '#6b7280';

	return (
		<Card>
			<CardHeader className="pb-1 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Target className="h-4 w-4" />
					{t('dashboard.compositeScore')}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-3 pb-3">
				{/* Gauge */}
				<div className="relative">
					<NeedleGauge score={score} color={gaugeColor} />
					<div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center pointer-events-none">
						<div
							className="text-xl font-black font-mono tabular-nums leading-tight"
							style={{ color: gaugeColor }}
						>
							{score.toFixed(0)}
						</div>
						<div
							className="text-[9px] uppercase tracking-widest font-semibold"
							style={{ color: gaugeColor }}
						>
							{direction}
						</div>
					</div>
				</div>

				{/* Block sub-scores */}
				{Object.keys(blocks).length > 0 && (
					<div className="grid grid-cols-3 gap-1 mt-2">
						{Object.entries(blocks).map(
							([key, val]: [string, any]) => {
								const s = val?.score ?? 50;
								const sig = val?.signal ?? 'NEUTRAL';
								const c =
									sig === 'BUY'
										? 'text-buy'
										: sig === 'SELL'
											? 'text-sell'
											: 'text-muted-foreground';
								return (
									<div
										key={key}
										className="flex flex-col items-center gap-0.5 rounded border border-border/50 px-1 py-1 bg-muted/20"
									>
										<span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
											{BLOCK_LABELS[key] ?? key}
										</span>
										<div className="w-full bg-muted rounded-full h-1">
											<div
												className="h-1 rounded-full transition-all"
												style={{
													width: `${s}%`,
													background:
														sig === 'BUY'
															? '#22c55e'
															: sig ===
																  'SELL'
																? '#ef4444'
																: '#6b7280',
												}}
											/>
										</div>
										<span
											className={`text-[9px] font-bold tabular-nums font-mono ${c}`}
										>
											{s}
										</span>
									</div>
								);
							},
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
