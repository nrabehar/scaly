import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import {
    useSignalHistory,
    useSignalAccuracy,
} from '@/hooks/use-market-data';
import { getSharedSocket } from '@/hooks/use-socket';
import { subscribeLiveTick } from '@/lib/liveTickBus';
import { useQueryClient } from '@tanstack/react-query';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { History } from 'lucide-react';
import { format } from 'date-fns';

const sigConfig = (
	side?: string,
): { arrow: string; color: string; border: string; bg: string } => {
	const s = (side ?? '').toUpperCase();
	if (s === 'BUY' || s === 'LONG')
		return {
			arrow: '↑',
			color: 'text-buy',
			border: 'border-l-buy/70',
			bg: 'bg-buy/5',
		};
	if (s === 'SELL' || s === 'SHORT')
		return {
			arrow: '↓',
			color: 'text-sell',
			border: 'border-l-sell/70',
			bg: 'bg-sell/5',
		};
	return {
		arrow: '—',
		color: 'text-muted-foreground',
		border: 'border-l-muted',
		bg: '',
	};
};

const convictionColor = (v?: string) => {
	const u = (v ?? '').toUpperCase();
	if (u === 'HIGH') return 'bg-buy/15 text-buy';
	if (u === 'LOW' || u === 'CONFLICT') return 'bg-sell/15 text-sell';
	if (u === 'MEDIUM') return 'bg-yellow-400/15 text-yellow-400';
	return 'bg-muted text-muted-foreground';
};

const outcomeStyle = (outcome?: string) => {
	const u = (outcome ?? '').toUpperCase();
	if (u === 'WIN') return 'bg-buy/15 text-buy';
	if (u === 'LOSS') return 'bg-sell/15 text-sell';
	return 'bg-muted/60 text-muted-foreground';
};

export function SignalHistoryPanel() {
	const { t } = useTranslation();
	const { currentSymbol } = useMarket();
	const queryClient = useQueryClient();
	const { data: histResp } = useSignalHistory(currentSymbol);
	const { data: accResp } = useSignalAccuracy(currentSymbol);

	// Local overlay: stores real-time resolution patches { id → outcome }
	// so we don't have to wait for the 10 s poll to show WIN/LOSS.
	const [resolvedMap, setResolvedMap] = useState<Record<number, string>>(
		{},
	);

	// ── Global real-time prices for ALL symbols ────────────────────────────
	// One subscription catches every symbol so every open row can show live P&L.
	const [livePrices, setLivePrices] = useState<Record<string, number>>(
		{},
	);
	useEffect(() => {
		return subscribeLiveTick((tick) => {
			setLivePrices((prev) =>
				prev[tick.symbol] === tick.price
					? prev
					: { ...prev, [tick.symbol]: tick.price },
			);
		});
	}, []);

	useEffect(() => {
		const socket = getSharedSocket();
		const handler = (payload: {
			id: number;
			symbol: string;
			outcome: string;
		}) => {
			setResolvedMap((prev) => ({
				...prev,
				[payload.id]: payload.outcome,
			}));
			// Invalidate accuracy so win-rate bar updates immediately
			void queryClient.invalidateQueries({
				queryKey: ['signal-accuracy', currentSymbol],
			});
		};
		socket.on('signal-resolved', handler);
		return () => {
			socket.off('signal-resolved', handler);
		};
	}, [currentSymbol, queryClient]);

	const rawSignals: any[] = (histResp as any)?.signals ?? [];
	// Merge WS resolutions on top of DB data
	const signals: any[] = rawSignals.map((s: any) =>
		resolvedMap[s.id]
			? { ...s, outcome: resolvedMap[s.id], resolved: true }
			: s,
	);
	const accuracy = accResp as any;

	const winRate: number = accuracy?.winRate ?? 0;
	const total: number = accuracy?.total ?? 0;
	const wins: number = accuracy?.wins ?? 0;
	const losses: number = accuracy?.losses ?? 0;

	return (
		<Card className="col-span-full">
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<History className="h-4 w-4" />
					{t('dashboard.signalHistory')}
					{total > 0 && (
						<span className="ml-auto flex items-center gap-2">
							<span className="text-[10px] text-muted-foreground">
								{wins}W&nbsp;/&nbsp;{losses}L
							</span>
							<span
								className={`text-[11px] font-bold px-2 py-0.5 rounded ${
									winRate >= 55
										? 'bg-buy/15 text-buy'
										: winRate >= 45
											? 'bg-yellow-400/15 text-yellow-400'
											: 'bg-sell/15 text-sell'
								}`}
							>
								{winRate.toFixed(1)}% WR
							</span>
						</span>
					)}
				</CardTitle>
				{total > 0 && (
					<div className="relative mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
						<div
							className="absolute top-0 left-0 h-1.5 rounded-full"
							style={{
								width: `${winRate}%`,
								background:
									winRate >= 55
										? '#22c55e'
										: winRate >= 45
											? '#eab308'
											: '#ef4444',
								transition: 'width 0.6s ease',
							}}
						/>
					</div>
				)}
			</CardHeader>
			<CardContent className="px-4 pb-3">
				{signals.length === 0 ? (
					<p className="text-center text-xs text-muted-foreground py-4">
						{t('signals.noSignals')}
					</p>
				) : (
					<div className="space-y-1 max-h-64 overflow-y-auto trading-scroll pr-1">
						{signals.slice(0, 50).map((s: any, i: number) => {
							const plan = s.metadata?.plan as
								| {
										entry?: number;
										tp?: number;
										sl?: number;
										rr?: number;
								  }
								| undefined;
							const aiConsensus = s.metadata?.aiConsensus as
								| { conviction?: string }
								| undefined;
							const sig =
								s.signal === 'BUY' ||
								s.signal === 'SELL' ||
								s.signal === 'HOLD'
									? s.signal
									: null;
							const cfg = sigConfig(sig ?? undefined);
							const outcome: string | undefined = s.outcome;

							// ── Live P&L for OPEN positions ──────────────────
							const isOpen = !outcome;
							const livePrice = livePrices[s.symbol];
							const dir =
								sig === 'BUY'
									? 1
									: sig === 'SELL'
										? -1
										: 0;
							const entry = plan?.entry;
							const tp = plan?.tp;
							const sl = plan?.sl;

							let pnlPts: number | null = null;
							let pnlPct: number | null = null;
							let tpProg = 0;
							let slProg = 0;

							if (
								isOpen &&
								dir !== 0 &&
								entry != null &&
								tp != null &&
								sl != null &&
								livePrice != null
							) {
								pnlPts = (livePrice - entry) * dir;
								pnlPct = (pnlPts / entry) * 100;
								const tpRange = Math.abs(tp - entry);
								const slRange = Math.abs(sl - entry);
								tpProg =
									tpRange > 0
										? Math.max(
												0,
												Math.min(
													100,
													(pnlPts / tpRange) *
														100,
												),
											)
										: 0;
								slProg =
									slRange > 0
										? Math.max(
												0,
												Math.min(
													100,
													(-pnlPts / slRange) *
														100,
												),
											)
										: 0;
							}

							// outcome = resolved by backend (WIN/LOSS) — never override with client-side label
							const isWin = pnlPts != null && pnlPts > 0;
							const isFlat =
								pnlPts != null && Math.abs(pnlPts) < 0.005;

							return (
								<div
									key={s.id ?? i}
									className={`rounded-sm border-l-2 px-2 py-1.5 text-[11px] ${cfg.border} ${cfg.bg}`}
								>
									{/* Main row */}
									<div className="flex items-center gap-2">
										<span
											className={`text-base leading-none font-bold w-4 shrink-0 ${cfg.color}`}
										>
											{cfg.arrow}
										</span>
										<span
											className={`font-bold uppercase w-8 shrink-0 ${cfg.color}`}
										>
											{sig ?? '—'}
										</span>

										<div className="flex flex-col min-w-0 flex-1">
											<span className="font-medium truncate">
												{s.symbol ?? '—'}
											</span>
											<span className="text-[9px] font-mono text-muted-foreground">
												{s.createdAt
													? format(
															new Date(
																s.createdAt,
															),
															'MM/dd HH:mm',
														)
													: '—'}
											</span>
										</div>

										{plan && (
											<div className="flex flex-col items-end text-[9px] font-mono tabular-nums leading-tight shrink-0">
												<span className="text-muted-foreground">
													{plan.entry?.toFixed(
														2,
													) ?? '—'}
												</span>
												<span className="text-buy">
													TP{' '}
													{plan.tp?.toFixed(2) ??
														'—'}
												</span>
												<span className="text-sell">
													SL{' '}
													{plan.sl?.toFixed(2) ??
														'—'}
												</span>
											</div>
										)}

										{plan?.rr != null && (
											<span className="text-[9px] font-mono text-muted-foreground shrink-0">
												{plan.rr.toFixed(1)}R
											</span>
										)}

										{aiConsensus?.conviction && (
											<span
												className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${convictionColor(aiConsensus.conviction)}`}
											>
												{aiConsensus.conviction
													.slice(0, 3)
													.toUpperCase()}
											</span>
										)}

										{/* Outcome chip: WIN/LOSS if closed by backend, live pts if open */}
										{outcome ? (
											<span
												className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${outcomeStyle(outcome)}`}
											>
												{outcome.toUpperCase()}
											</span>
										) : pnlPts != null ? (
											<span
												className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 font-mono tabular-nums ${
													isFlat
														? 'bg-muted text-muted-foreground'
														: isWin
															? 'bg-buy/15 text-buy'
															: 'bg-sell/15 text-sell'
												}`}
											>
												{pnlPts > 0 ? '+' : ''}
												{pnlPts.toFixed(2)}
											</span>
										) : (
											<span className="text-[9px] text-muted-foreground shrink-0">
												OPEN
											</span>
										)}
									</div>

									{/* Live P&L sub-row — only for open positions with a live tick */}
									{isOpen &&
										!outcome &&
										livePrice != null &&
										pnlPts != null && (
											<div className="mt-1 space-y-0.5 pl-6">
												{/* Current price + pts + % */}
												<div
													className={`flex justify-between font-mono tabular-nums text-[10px] font-semibold ${
														isFlat
															? 'text-muted-foreground'
															: isWin
																? 'text-buy'
																: 'text-sell'
													}`}
												>
													<span className="text-muted-foreground font-normal">
														Now{' '}
														<span className="text-foreground">
															{livePrice.toFixed(
																2,
															)}
														</span>
													</span>
													<span>
														{pnlPts > 0
															? '+'
															: ''}
														{pnlPts.toFixed(2)}{' '}
														pts
													</span>
													<span className="text-[9px] opacity-80">
														{pnlPct != null &&
															`${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(3)}%`}
													</span>
												</div>

												{/* Progress bar: centre = entry, right = TP, left = SL */}
												<div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
													{tpProg > 0 && (
														<div
															className="absolute inset-y-0 left-1/2 rounded-r-full bg-buy transition-all duration-300"
															style={{
																width: `${Math.min(50, tpProg / 2)}%`,
															}}
														/>
													)}
													{slProg > 0 && (
														<div
															className="absolute inset-y-0 right-1/2 rounded-l-full bg-sell transition-all duration-300"
															style={{
																width: `${Math.min(50, slProg / 2)}%`,
															}}
														/>
													)}
													<div className="absolute inset-y-0 left-1/2 w-px bg-border/60" />
												</div>
											</div>
										)}
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
