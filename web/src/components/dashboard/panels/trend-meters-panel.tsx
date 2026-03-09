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
import { Gauge } from 'lucide-react';
import type { Candle } from '@/types/market';

function MeterBar({
	label,
	score,
	signal,
}: {
	label: string;
	score: number;
	signal: string;
}) {
	const c =
		signal === 'BUY'
			? '#22c55e'
			: signal === 'SELL'
				? '#ef4444'
				: '#6b7280';
	return (
		<div className="space-y-0.5">
			<div className="flex justify-between text-[10px]">
				<span className="text-muted-foreground">{label}</span>
				<span
					className="font-mono tabular-nums font-medium"
					style={{ color: c }}
				>
					{signal}
				</span>
			</div>
			<div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
				<div
					className="rounded-full transition-all"
					style={{ width: `${score}%`, background: c }}
				/>
			</div>
		</div>
	);
}

const BLOCK_LABELS: Record<string, string> = {
	trend: 'Trend',
	momentum: 'Momentum',
	volume: 'Volume',
	volatility: 'Volatility',
	structure: 'Structure',
	confirmation: 'MTF Conf.',
};

export function TrendMetersPanel() {
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
	const trend = ind?.trend;
	const blocks = combo?.blocks ?? {};

	// BUY/SELL signal counts from individual indicators
	const bullishPct = trend?.bullishPct ?? 0;
	const bearishPct = trend?.bearishPct ?? 0;
	const bullCount = trend?.bullishCount ?? 0;
	const bearCount = trend?.bearishCount ?? 0;

	// Top key reasons (max 3)
	const topReasons: string[] = useMemo(() => {
		const reasons: string[] = [];
		for (const block of Object.values(blocks) as any[]) {
			for (const r of (block?.reasons ?? []).slice(0, 1)) {
				reasons.push(r);
				if (reasons.length >= 3) return reasons;
			}
		}
		return reasons;
	}, [blocks]);

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Gauge className="h-4 w-4" />
					{t('dashboard.trendMeters')}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-3 pb-3 space-y-2">
				{/* BUY / SELL stat boxes */}
				<div className="grid grid-cols-2 gap-2">
					<div className="rounded-lg border border-buy/30 bg-buy/5 px-3 py-2 text-center">
						<div className="text-[9px] font-bold text-buy uppercase tracking-wider mb-0.5">
							BUY
						</div>
						<div className="text-xl font-black font-mono text-buy leading-none">
							{bullishPct}%
						</div>
						<div className="text-[9px] text-muted-foreground mt-0.5">
							{bullCount} signals
						</div>
					</div>
					<div className="rounded-lg border border-sell/30 bg-sell/5 px-3 py-2 text-center">
						<div className="text-[9px] font-bold text-sell uppercase tracking-wider mb-0.5">
							SELL
						</div>
						<div className="text-xl font-black font-mono text-sell leading-none">
							{bearishPct}%
						</div>
						<div className="text-[9px] text-muted-foreground mt-0.5">
							{bearCount} signals
						</div>
					</div>
				</div>

				{/* Overall combo label */}
				{combo && (
					<div className="flex items-center justify-between text-xs px-0.5">
						<span className="text-muted-foreground font-semibold">
							Pro Confluence
						</span>
						<span
							className="font-bold"
							style={{
								color:
									combo.score > 60
										? '#22c55e'
										: combo.score < 40
											? '#ef4444'
											: '#6b7280',
							}}
						>
							{combo.direction} · {combo.score}
						</span>
					</div>
				)}

				{/* Block breakdown */}
				<div className="space-y-1.5 pt-0.5">
					{Object.entries(blocks).map(
						([key, val]: [string, any]) => (
							<MeterBar
								key={key}
								label={BLOCK_LABELS[key] ?? key}
								score={val?.score ?? 50}
								signal={val?.signal ?? 'NEUTRAL'}
							/>
						),
					)}
				</div>

				{/* Key reasons */}
				{topReasons.length > 0 && (
					<div className="pt-1 space-y-0.5">
						<p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
							Key factors
						</p>
						{topReasons.map((r, i) => (
							<div
								key={i}
								className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
							>
								<span
									className={
										r.toLowerCase().includes('bull') ||
										r.toLowerCase().includes('buy') ||
										r
											.toLowerCase()
											.includes('rising') ||
										r
											.toLowerCase()
											.includes('positive')
											? 'text-buy'
											: 'text-sell'
									}
								>
									{r.toLowerCase().includes('bull') ||
									r.toLowerCase().includes('buy') ||
									r.toLowerCase().includes('rising') ||
									r.toLowerCase().includes('positive')
										? '↗'
										: '↘'}
								</span>
								{r}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
