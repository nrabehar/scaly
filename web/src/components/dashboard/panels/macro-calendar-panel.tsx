import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useMarket } from '@/contexts/market.context';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { CalendarDays, Loader2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type MacroImportance = 'high' | 'medium' | 'low';
type MacroImpact = 'bullish' | 'bearish' | 'neutral';

interface MacroEvent {
	id: string;
	title: string;
	country: string;
	flag: string;
	importance: MacroImportance;
	previous: string | null;
	expected: string | null;
	actual: string | null;
	timestamp: number;
	status: 'upcoming' | 'past';
	impact: MacroImpact;
}

interface MacroCalendarResponse {
	success: boolean;
	symbol?: string;
	source?: string;
	generatedAt?: string;
	total?: number;
	events?: MacroEvent[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function importanceDots(level: MacroImportance) {
	if (level === 'high') return { glyph: '●●●', color: 'text-sell' };
	if (level === 'medium')
		return { glyph: '●●○', color: 'text-yellow-400' };
	return { glyph: '●○○', color: 'text-muted-foreground' };
}

function impactBadge(impact: MacroImpact) {
	if (impact === 'bullish') return { icon: '▲', cls: 'text-buy' };
	if (impact === 'bearish') return { icon: '▼', cls: 'text-sell' };
	return { icon: '•', cls: 'text-muted-foreground' };
}

function fmtClock(ts: number) {
	try {
		return new Date(ts).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return '--:--';
	}
}

function fmtRelative(ts: number, now: number) {
	const d = ts - now;
	const abs = Math.abs(d);
	const mins = Math.round(abs / 60000);
	const hours = Math.round(abs / 3600000);
	const days = Math.round(abs / 86400000);
	if (d >= 0) {
		if (days >= 1) return `In ${days}d`;
		if (hours >= 1) return `In ${hours}h`;
		return `In ${Math.max(1, mins)}m`;
	}
	if (days >= 1) return `${days}d ago`;
	if (hours >= 1) return `${hours}h ago`;
	return `${Math.max(1, mins)}m ago`;
}

async function fetchMacroCalendar(
	symbol: string,
): Promise<MacroCalendarResponse> {
	const res = await fetch(
		`/api/macro-calendar?symbol=${encodeURIComponent(symbol)}`,
	);
	return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MacroCalendarPanel() {
	const { t } = useTranslation();
	const { currentSymbol } = useMarket();
	const [nowTs, setNowTs] = useState(() => Date.now());

	// Refresh relative times every 30 s
	useEffect(() => {
		const id = window.setInterval(() => setNowTs(Date.now()), 30000);
		return () => clearInterval(id);
	}, []);

	const { data, isLoading } = useQuery<MacroCalendarResponse>({
		queryKey: ['macro-calendar', currentSymbol],
		queryFn: () => fetchMacroCalendar(currentSymbol),
		staleTime: 30_000,
		refetchInterval: 60_000,
	});

	const events: MacroEvent[] = Array.isArray(data?.events)
		? data!.events!
		: [];
	const preview = events.slice(0, 18);

	const highCount = preview.filter(
		(e) => e.importance === 'high',
	).length;
	const medCount = preview.filter(
		(e) => e.importance === 'medium',
	).length;
	const lowCount = preview.filter((e) => e.importance === 'low').length;
	const upcoming = preview.filter((e) => e.status === 'upcoming').length;

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<CalendarDays className="h-4 w-4" />
					{t('dashboard.macroCalendar', 'Macro Calendar')}
					{isLoading && (
						<Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground" />
					)}
					{!isLoading && preview.length > 0 && (
						<div className="ml-auto flex items-center gap-2 text-[10px]">
							<span className="text-sell">
								● {highCount}
							</span>
							<span className="text-yellow-400">
								● {medCount}
							</span>
							<span className="text-muted-foreground">
								● {lowCount}
							</span>
							<span className="text-muted-foreground">
								↑{upcoming}
							</span>
						</div>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-3">
				{isLoading && (
					<p className="text-xs text-muted-foreground py-4 text-center">
						{t('common.loading', 'Loading…')}
					</p>
				)}

				{!isLoading && preview.length === 0 && (
					<p className="text-xs text-muted-foreground py-4 text-center">
						{t('macro.noEvents', 'No macro events available.')}
					</p>
				)}

				{!isLoading && preview.length > 0 && (
					<div className="rounded border border-border/50 overflow-hidden">
						{/* Header row */}
						<div className="grid grid-cols-[44px_32px_1fr_52px_44px] gap-1 px-2 py-1 bg-muted/40 text-[9px] uppercase tracking-wide text-muted-foreground border-b border-border/50">
							<span>Time</span>
							<span>Imp</span>
							<span>Event</span>
							<span className="text-right">Prev/Exp</span>
							<span className="text-right">Status</span>
						</div>

						{/* Event rows */}
						<div className="max-h-72 overflow-y-auto trading-scroll divide-y divide-border/30">
							{preview.map((ev) => {
								const imp = importanceDots(ev.importance);
								const impct = impactBadge(ev.impact);
								const isPast = ev.status === 'past';

								return (
									<div
										key={ev.id}
										className={`grid grid-cols-[44px_32px_1fr_52px_44px] gap-1 px-2 py-1.5 text-[10px] items-center ${isPast ? 'opacity-50' : ''}`}
									>
										{/* Time */}
										<span className="font-mono tabular-nums text-muted-foreground">
											{fmtClock(ev.timestamp)}
										</span>

										{/* Importance dots */}
										<span
											className={`font-mono text-[9px] ${imp.color}`}
											title={ev.importance.toUpperCase()}
										>
											{imp.glyph}
										</span>

										{/* Flag + title */}
										<span className="flex items-center gap-1 min-w-0">
											<span className="shrink-0">
												{ev.flag}
											</span>
											<span className="font-semibold truncate text-foreground/90">
												{ev.title}
											</span>
										</span>

										{/* Prev / Exp or Actual */}
										<div className="flex flex-col items-end font-mono tabular-nums text-[9px] text-muted-foreground leading-tight">
											{ev.actual ? (
												<span className="text-foreground font-bold">
													{ev.actual}
												</span>
											) : (
												<>
													{ev.expected && (
														<span className="text-foreground/70">
															{ev.expected}
														</span>
													)}
													{ev.previous && (
														<span>
															{ev.previous}
														</span>
													)}
												</>
											)}
										</div>

										{/* Impact + relative time */}
										<div
											className={`flex items-center justify-end gap-1 font-mono text-[9px] ${impct.cls}`}
										>
											<span>{impct.icon}</span>
											<span>
												{fmtRelative(
													ev.timestamp,
													nowTs,
												)}
											</span>
										</div>
									</div>
								);
							})}
						</div>

						{/* Footer: source */}
						{data?.source && (
							<div className="px-2 py-1 text-[9px] text-muted-foreground border-t border-border/30 text-right">
								{data.source}
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
