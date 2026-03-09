import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { usePrice, useHistory } from '@/hooks/use-market-data';
import { useIndicators } from '@/hooks/use-indicators';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';
import type { Candle } from '@/types/market';

export function MarketInfoPanel() {
	const { t } = useTranslation();
	const { currentSymbol, currentTimeframe } = useMarket();
	const { data: price } = usePrice(currentSymbol);
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

	const spread =
		price?.bid != null && price?.ask != null
			? price.ask - price.bid
			: null;
	const last = candles.length > 0 ? candles[candles.length - 1] : null;
	const firstOfSession = candles.length > 0 ? candles[0] : null;

	// Daily / session change
	const openPrice = firstOfSession?.open ?? null;
	const currentClose = last?.close ?? price?.price ?? null;
	const changePct =
		openPrice && currentClose
			? ((currentClose - openPrice) / openPrice) * 100
			: null;
	const changeAbs =
		openPrice && currentClose ? currentClose - openPrice : null;
	const isUp = (changePct ?? 0) >= 0;

	// Total session volume
	const totalVolume = useMemo(
		() => candles.reduce((sum, c) => sum + (c.volume ?? 0), 0),
		[candles],
	);

	// Price position within session high/low (0–100%)
	const sessionHigh = useMemo(
		() => candles.reduce((m, c) => Math.max(m, c.high), -Infinity),
		[candles],
	);
	const sessionLow = useMemo(
		() => candles.reduce((m, c) => Math.min(m, c.low), Infinity),
		[candles],
	);
	const pricePos =
		sessionHigh > sessionLow && currentClose != null
			? Math.round(
					((currentClose - sessionLow) /
						(sessionHigh - sessionLow)) *
						100,
				)
			: null;

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Info className="h-4 w-4" />
					{t('dashboard.marketInfo')}
					{/* Session change chip */}
					{changePct != null && (
						<span
							className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
								isUp
									? 'text-buy bg-buy/10'
									: 'text-sell bg-sell/10'
							}`}
						>
							{isUp ? (
								<TrendingUp className="h-3 w-3" />
							) : (
								<TrendingDown className="h-3 w-3" />
							)}
							{isUp ? '+' : ''}
							{changePct.toFixed(2)}%
						</span>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-3 space-y-2">
				{/* Price position bar within session range */}
				{pricePos != null && (
					<div>
						<div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
							<span>L {sessionLow.toFixed(2)}</span>
							<span className="font-bold text-foreground">
								{currentClose?.toFixed(2)}
							</span>
							<span>H {sessionHigh.toFixed(2)}</span>
						</div>
						<div className="relative h-2 bg-muted rounded-full overflow-hidden">
							<div
								className="absolute top-0 h-2 w-1.5 rounded-full"
								style={{
									left: `calc(${pricePos}% - 3px)`,
									background: isUp
										? '#22c55e'
										: '#ef4444',
									transition: 'left 0.5s ease',
								}}
							/>
						</div>
					</div>
				)}

				{/* Data rows */}
				<div className="space-y-0.5">
					{[
						{
							label: t('market.bid'),
							value: price?.bid?.toFixed(2),
						},
						{
							label: t('market.ask'),
							value: price?.ask?.toFixed(2),
						},
						{
							label: t('market.spread'),
							value:
								spread != null
									? spread.toFixed(2)
									: undefined,
							color:
								spread != null
									? spread < 1
										? 'text-buy'
										: spread > 3
											? 'text-sell'
											: undefined
									: undefined,
						},
						{ label: 'Open', value: openPrice?.toFixed(2) },
						{
							label: t('market.high'),
							value: last?.high?.toFixed(2),
							color: 'text-buy',
						},
						{
							label: t('market.low'),
							value: last?.low?.toFixed(2),
							color: 'text-sell',
						},
						{
							label: 'Change',
							value:
								changeAbs != null
									? `${isUp ? '+' : ''}${changeAbs.toFixed(2)}`
									: undefined,
							color: isUp ? 'text-buy' : 'text-sell',
						},
						{ label: 'VWAP', value: ind?.vwap?.toFixed(2) },
						{ label: 'ATR(14)', value: ind?.atr?.toFixed(2) },
						{
							label: 'Volume',
							value:
								totalVolume > 0
									? totalVolume > 1e6
										? `${(totalVolume / 1e6).toFixed(1)}M`
										: totalVolume > 1e3
											? `${(totalVolume / 1e3).toFixed(0)}K`
											: totalVolume.toFixed(0)
									: undefined,
						},
						{
							label: t('market.source'),
							value: price?.source ?? '—',
						},
					].map((row) => (
						<div
							key={row.label}
							className="flex justify-between items-center py-0.5"
						>
							<span className="text-[11px] text-muted-foreground">
								{row.label}
							</span>
							<span
								className={`font-mono text-xs tabular-nums font-medium ${row.color ?? ''}`}
							>
								{row.value ?? '—'}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
