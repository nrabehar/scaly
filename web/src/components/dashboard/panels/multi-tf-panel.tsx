import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useMultiTF } from '@/hooks/use-market-data';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { calcRSI } from '@/lib/indicators/momentum';
import { calcEMA } from '@/lib/indicators/trend';

const TIMEFRAMES = ['1min', '5min', '15min', '1h'] as const;

function analyzeTF(data: any[] | undefined) {
	if (!data || data.length < 30)
		return {
			rsi: null,
			trend: null as string | null,
			signal: null as string | null,
		};
	const closes = data.map((c: any) => c.close);
	const rsi = calcRSI(closes, 14);
	const ema9a = calcEMA(closes, 9);
	const ema21a = calcEMA(closes, 21);

	let trend: string = 'NEUTRAL';
	if (ema9a && ema21a && ema9a.length > 0 && ema21a.length > 0) {
		const ema9 = ema9a[ema9a.length - 1];
		const ema21 = ema21a[ema21a.length - 1];
		trend =
			ema9 > ema21
				? 'BULLISH'
				: ema9 < ema21
					? 'BEARISH'
					: 'NEUTRAL';
	}

	let signal = 'NEUTRAL';
	if (rsi !== null) {
		if (rsi < 35 && trend === 'BULLISH') signal = 'BUY';
		else if (rsi > 65 && trend === 'BEARISH') signal = 'SELL';
		else if (trend === 'BULLISH') signal = 'LEAN BUY';
		else if (trend === 'BEARISH') signal = 'LEAN SELL';
	}
	return { rsi, trend, signal };
}

export function MultiTFPanel() {
	const { t } = useTranslation();
	const { currentSymbol } = useMarket();
	const { data: multiResp } = useMultiTF(currentSymbol);

	const frames = (multiResp as any)?.frames ?? {};

	const analyses = useMemo(
		() =>
			TIMEFRAMES.map((tf) => ({
				tf,
				...analyzeTF(frames[tf]?.data),
			})),
		[frames],
	);

	// Global consensus
	const buyCount = analyses.filter((a) =>
		a.signal?.includes('BUY'),
	).length;
	const sellCount = analyses.filter((a) =>
		a.signal?.includes('SELL'),
	).length;
	const consensusSignal =
		buyCount > sellCount
			? 'BUY'
			: sellCount > buyCount
				? 'SELL'
				: 'NEUTRAL';
	const strength = Math.round(
		(Math.max(buyCount, sellCount) / TIMEFRAMES.length) * 100,
	);

	const signalColor = (s: string | null) => {
		if (!s) return 'text-muted-foreground';
		if (s.includes('BUY')) return 'text-buy';
		if (s.includes('SELL')) return 'text-sell';
		return 'text-muted-foreground';
	};

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Layers className="h-4 w-4" />
					{t('dashboard.multiTF')}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-3 pb-3 space-y-2">
				{/* Global consensus box */}
				<div
					className={`rounded-lg border px-3 py-2 text-center ${
						consensusSignal === 'BUY'
							? 'bg-buy/5 border-buy/30'
							: consensusSignal === 'SELL'
								? 'bg-sell/5 border-sell/30'
								: 'bg-muted/30 border-border'
					}`}
				>
					<div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
						Global Consensus
					</div>
					<div
						className="text-base font-black"
						style={{
							color:
								consensusSignal === 'BUY'
									? '#22c55e'
									: consensusSignal === 'SELL'
										? '#ef4444'
										: '#6b7280',
						}}
					>
						{consensusSignal} · {strength}%
					</div>
					<div className="text-[9px] text-muted-foreground mt-0.5">
						{buyCount} BUY · {sellCount} SELL
					</div>
				</div>

				{/* Per-timeframe table */}
				<table className="w-full text-xs">
					<thead>
						<tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
							<th className="text-left pb-1">TF</th>
							<th className="text-right pb-1">RSI</th>
							<th className="text-right pb-1">
								{t('indicators.trend')}
							</th>
							<th className="text-right pb-1">
								{t('signals.signal')}
							</th>
						</tr>
					</thead>
					<tbody>
						{analyses.map(({ tf, rsi, trend, signal }) => (
							<tr
								key={tf}
								className="border-t border-border/50"
							>
								<td className="py-1 font-medium font-mono">
									{tf}
								</td>
								<td
									className={`text-right font-mono tabular-nums ${
										rsi != null && rsi > 70
											? 'text-sell'
											: rsi != null && rsi < 30
												? 'text-buy'
												: ''
									}`}
								>
									{rsi?.toFixed(1) ?? '—'}
								</td>
								<td
									className={`text-right ${trend === 'BULLISH' ? 'text-buy' : trend === 'BEARISH' ? 'text-sell' : 'text-muted-foreground'}`}
								>
									{trend === 'BULLISH'
										? '↑'
										: trend === 'BEARISH'
											? '↓'
											: '—'}
								</td>
								<td
									className={`text-right font-medium ${signalColor(signal)}`}
								>
									{signal ?? '—'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</CardContent>
		</Card>
	);
}
