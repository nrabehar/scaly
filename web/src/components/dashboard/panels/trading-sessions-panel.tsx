import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Clock } from 'lucide-react';

// ── Session config ────────────────────────────────────────────────────────────

type SessionKey = 'tokyo' | 'london' | 'newYork' | 'sydney';

interface SessionConfig {
	key: SessionKey;
	label: string;
	timeZone: string;
	startHour: number;
	endHour: number;
	color: string;
}

interface SegmentRange {
	start: number;
	end: number;
}

const SESSION_CONFIGS: SessionConfig[] = [
	{
		key: 'tokyo',
		label: 'Tokyo',
		timeZone: 'Asia/Tokyo',
		startHour: 9,
		endHour: 18,
		color: '#4fa3ff',
	},
	{
		key: 'london',
		label: 'London',
		timeZone: 'Europe/London',
		startHour: 8,
		endHour: 17,
		color: '#22c55e',
	},
	{
		key: 'newYork',
		label: 'New York',
		timeZone: 'America/New_York',
		startHour: 8,
		endHour: 17,
		color: '#f59e0b',
	},
	{
		key: 'sydney',
		label: 'Sydney',
		timeZone: 'Australia/Sydney',
		startHour: 8,
		endHour: 17,
		color: '#a855f7',
	},
];

// ── Pure time helpers ─────────────────────────────────────────────────────────

function getLocalHM(
	date: Date,
	tz: string,
): { hour: number; minute: number; label: string } {
	try {
		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone: tz,
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		}).formatToParts(date);
		const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
		const m = Number(
			parts.find((p) => p.type === 'minute')?.value ?? 0,
		);
		return {
			hour: h,
			minute: m,
			label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
		};
	} catch {
		return { hour: 0, minute: 0, label: '--:--' };
	}
}

function withinMinutes(cur: number, start: number, end: number): boolean {
	if (start === end) return true;
	return start < end
		? cur >= start && cur < end
		: cur >= start || cur < end;
}

function isSessionOpen(date: Date, cfg: SessionConfig): boolean {
	const { hour, minute } = getLocalHM(date, cfg.timeZone);
	return withinMinutes(
		hour * 60 + minute,
		cfg.startHour * 60,
		cfg.endHour * 60,
	);
}

function computeSegments(
	cfg: SessionConfig,
	dayStart: Date,
): SegmentRange[] {
	const segs: SegmentRange[] = [];
	let inside = isSessionOpen(dayStart, cfg);
	let segStart = inside ? 0 : -1;
	for (let m = 1; m <= 1440; m++) {
		const sample = new Date(dayStart.getTime() + m * 60000);
		const open = m < 1440 ? isSessionOpen(sample, cfg) : false;
		if (open === inside) continue;
		if (inside && segStart >= 0)
			segs.push({ start: segStart, end: m });
		else if (open) segStart = m;
		inside = open;
	}
	return segs;
}

function insideSegs(minute: number, segs: SegmentRange[]): boolean {
	return segs.some((s) => minute >= s.start && minute < s.end);
}

function minsUntilOpen(
	nowMin: number,
	openNow: boolean,
	today: SegmentRange[],
	tomorrow: SegmentRange[],
): number | null {
	if (openNow) return 0;
	const next = today.find((s) => s.start > nowMin);
	if (next) return next.start - nowMin;
	if (tomorrow.length) return 1440 - nowMin + tomorrow[0].start;
	return null;
}

function fmtMinute(m: number): string {
	const n = ((m % 1440) + 1440) % 1440;
	return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

function fmtDuration(min: number): string {
	const s = Math.max(0, Math.round(min));
	const h = Math.floor(s / 60),
		m = s % 60;
	if (h <= 0) return `${m}m`;
	if (m <= 0) return `${h}h`;
	return `${h}h ${m}m`;
}

function fmtSegs(segs: SegmentRange[]): string {
	if (!segs.length) return 'N/A';
	return segs
		.map((s) => `${fmtMinute(s.start)}-${fmtMinute(s.end)}`)
		.join(', ');
}

// ── SVG clock helpers ─────────────────────────────────────────────────────────

function minToAngle(min: number): number {
	return (min / 1440) * 360 - 90;
}

function polar(
	cx: number,
	cy: number,
	r: number,
	deg: number,
): { x: number; y: number } {
	const rad = (deg * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(
	cx: number,
	cy: number,
	r: number,
	startMin: number,
	endMin: number,
): string {
	const s = polar(cx, cy, r, minToAngle(startMin));
	const e = polar(cx, cy, r, minToAngle(endMin));
	const large = endMin - startMin > 720 ? 1 : 0;
	return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TradingSessionsPanel() {
	const { t } = useTranslation();
	const [now, setNow] = useState<Date>(() => new Date());

	useEffect(() => {
		const id = window.setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);

	const userTZ = useMemo(() => {
		try {
			return (
				Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
			);
		} catch {
			return 'UTC';
		}
	}, []);

	const nowMinute = now.getHours() * 60 + now.getMinutes();

	const rows = useMemo(() => {
		const dayStart = new Date(now);
		dayStart.setHours(0, 0, 0, 0);
		const tomorrow = new Date(dayStart.getTime() + 86400000);

		return SESSION_CONFIGS.map((cfg) => {
			const todaySegs = computeSegments(cfg, dayStart);
			const tomorrowSegs = computeSegments(cfg, tomorrow);
			const openNow = insideSegs(nowMinute, todaySegs);
			const nextOpen = minsUntilOpen(
				nowMinute,
				openNow,
				todaySegs,
				tomorrowSegs,
			);
			return {
				...cfg,
				todaySegs,
				openNow,
				nextOpen,
				localClock: getLocalHM(now, cfg.timeZone).label,
				window: fmtSegs(todaySegs),
			};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		now.getHours(),
		now.getMinutes(),
		nowMinute,
	]);

	const active = rows.filter((r) => r.openNow);
	const londonNY =
		rows.find((r) => r.key === 'london')?.openNow &&
		rows.find((r) => r.key === 'newYork')?.openNow;
	const sydneyTKY =
		rows.find((r) => r.key === 'sydney')?.openNow &&
		rows.find((r) => r.key === 'tokyo')?.openNow;
	const nextSession = rows
		.filter((r) => !r.openNow && r.nextOpen != null)
		.sort((a, b) => (a.nextOpen ?? 0) - (b.nextOpen ?? 0))[0];

	const displayClock = now.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});

	// SVG clock params
	const CX = 110,
		CY = 110,
		R_MAX = 88,
		SPACING = 17;
	const needleAngle = minToAngle(nowMinute + now.getSeconds() / 60);
	const needlePt = polar(CX, CY, R_MAX + 5, needleAngle);

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Clock className="h-4 w-4" />
					{t('dashboard.tradingSessions', 'Trading Sessions')}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-3 space-y-3">
				{/* Active session alert */}
				<div
					className={`rounded px-2.5 py-1.5 text-[11px] font-medium ${active.length > 0 ? 'bg-buy/10 text-buy border border-buy/30' : 'bg-muted/50 text-muted-foreground'}`}
				>
					{active.length > 0
						? `Active: ${active.map((s) => s.label).join(', ')}`
						: nextSession
							? `Next: ${nextSession.label} in ${fmtDuration(nextSession.nextOpen ?? 0)}`
							: 'No major session open'}
				</div>

				{/* Overlap badges */}
				<div className="flex gap-2 flex-wrap">
					<span
						className={`text-[10px] font-bold px-2 py-0.5 rounded border ${londonNY ? 'bg-buy/10 text-buy border-buy/30' : 'bg-muted/50 text-muted-foreground border-border/50'}`}
					>
						London–NY {londonNY ? 'ON' : 'OFF'}
					</span>
					<span
						className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sydneyTKY ? 'bg-[#4fa3ff]/10 text-[#4fa3ff] border-[#4fa3ff]/30' : 'bg-muted/50 text-muted-foreground border-border/50'}`}
					>
						Sydney–Tokyo {sydneyTKY ? 'ON' : 'OFF'}
					</span>
				</div>

				{/* SVG ring clock */}
				<div className="flex justify-center">
					<svg
						viewBox="0 0 220 220"
						className="w-52 h-52"
						aria-label="Trading sessions clock"
					>
						{/* Outer ring */}
						<circle
							cx={CX}
							cy={CY}
							r={R_MAX + 10}
							fill="none"
							stroke="hsl(var(--border))"
							strokeWidth={1}
						/>

						{/* Hour labels 0 / 6 / 12 / 18 */}
						{[0, 6, 12, 18].map((h) => {
							const p = polar(
								CX,
								CY,
								R_MAX + 16,
								minToAngle(h * 60),
							);
							return (
								<text
									key={h}
									x={p.x}
									y={p.y}
									textAnchor="middle"
									dominantBaseline="middle"
									fontSize={8}
									fill="hsl(var(--muted-foreground))"
								>
									{String(h).padStart(2, '0')}
								</text>
							);
						})}

						{/* Session arcs */}
						{rows.map((row, idx) => {
							const r = R_MAX - idx * SPACING;
							return (
								<g key={row.key}>
									<circle
										cx={CX}
										cy={CY}
										r={r}
										fill="none"
										stroke="hsl(var(--border)/0.3)"
										strokeWidth={8}
									/>
									{row.todaySegs.map((seg, si) => (
										<path
											key={si}
											d={arc(
												CX,
												CY,
												r,
												seg.start,
												seg.end,
											)}
											fill="none"
											stroke={row.color}
											strokeWidth={8}
											strokeLinecap="round"
											opacity={
												row.openNow ? 1 : 0.55
											}
										/>
									))}
								</g>
							);
						})}

						{/* Needle */}
						<line
							x1={CX}
							y1={CY}
							x2={needlePt.x}
							y2={needlePt.y}
							stroke="hsl(var(--foreground))"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
						<circle
							cx={CX}
							cy={CY}
							r={4}
							fill="hsl(var(--foreground))"
						/>

						{/* Centre disc */}
						<circle
							cx={CX}
							cy={CY}
							r={30}
							fill="hsl(var(--card))"
							stroke="hsl(var(--border))"
							strokeWidth={1}
						/>
						<text
							x={CX}
							y={CY - 7}
							textAnchor="middle"
							fontSize={7}
							fill="hsl(var(--muted-foreground))"
						>
							LOCAL
						</text>
						<text
							x={CX}
							y={CY + 8}
							textAnchor="middle"
							fontSize={9}
							fontWeight={700}
							fill="hsl(var(--foreground))"
						>
							{displayClock.slice(0, 5)}
						</text>
					</svg>
				</div>

				{/* Legend */}
				<div className="space-y-1">
					{rows.map((row) => (
						<div
							key={row.key}
							className="flex items-center gap-2 text-[10px]"
						>
							<span
								className="w-2 h-2 rounded-full shrink-0"
								style={{
									background: row.color,
									opacity: row.openNow ? 1 : 0.4,
								}}
							/>
							<span
								className={`font-semibold w-14 shrink-0 ${row.openNow ? 'text-foreground' : 'text-muted-foreground'}`}
							>
								{row.label}
							</span>
							<span
								className={`font-bold shrink-0 ${row.openNow ? 'text-buy' : 'text-muted-foreground'}`}
							>
								{row.openNow
									? 'OPEN'
									: row.nextOpen != null
										? `+${fmtDuration(row.nextOpen)}`
										: 'CLOSED'}
							</span>
							<span className="font-mono text-muted-foreground truncate">
								{row.localClock}
							</span>
						</div>
					))}
				</div>

				{/* Detected timezone */}
				<p className="text-[10px] text-muted-foreground">
					TZ: <span className="font-mono">{userTZ}</span>
				</p>
			</CardContent>
		</Card>
	);
}
