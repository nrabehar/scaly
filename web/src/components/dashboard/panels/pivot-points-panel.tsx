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
import { ArrowUpDown } from 'lucide-react';
import { formatSymbolPrice } from '@/lib/priceFormat';
import type { Candle } from '@/types/market';

export function PivotPointsPanel() {
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
	const pivots = ind?.pivotPoints;
	const currentPrice =
		candles.length > 0 ? candles[candles.length - 1].close : null;

	if (!pivots) {
		return (
			<Card>
				<CardHeader className="pb-2 pt-3 px-4">
					<CardTitle className="text-sm font-medium flex items-center gap-2">
						<ArrowUpDown className="h-4 w-4" />
						{t('dashboard.pivotPoints')}
					</CardTitle>
				</CardHeader>
				<CardContent className="px-4 pb-3 text-xs text-muted-foreground">
					{t('common.loading')}
				</CardContent>
			</Card>
		);
	}

	const fmt = (v: number | null | undefined) =>
		formatSymbolPrice(currentSymbol, v);

	const levels = [
		{ label: 'R3', value: pivots.r3, color: 'text-sell' },
		{ label: 'R2', value: pivots.r2, color: 'text-sell' },
		{ label: 'R1', value: pivots.r1, color: 'text-sell' },
		{ label: 'PP', value: pivots.pivot, color: 'text-gold' },
		{ label: 'S1', value: pivots.s1, color: 'text-buy' },
		{ label: 'S2', value: pivots.s2, color: 'text-buy' },
		{ label: 'S3', value: pivots.s3, color: 'text-buy' },
	];

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<ArrowUpDown className="h-4 w-4" />
					{t('dashboard.pivotPoints')}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-3">
				<div className="space-y-0.5">
					{levels.map((lvl) => {
						const isCurrent =
							currentPrice != null &&
							lvl.value != null &&
							Math.abs(currentPrice - lvl.value) <
								(ind?.atr ?? currentPrice * 0.001) * 0.3;
						return (
							<div
								key={lvl.label}
								className={`flex justify-between items-center py-0.5 rounded px-1 ${
									isCurrent ? 'bg-muted' : ''
								}`}
							>
								<span
									className={`text-xs font-medium ${lvl.color}`}
								>
									{lvl.label}
								</span>
								<span className="font-mono text-xs tabular-nums">
									{fmt(lvl.value)}
								</span>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
