import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/dashboard.layout';
import { MarketProvider } from '@/contexts/market.context';
import {
    InstrumentSelector,
    TradingChart,
    AiSignalPanel,
    IndicatorsPanel,
    TrendMetersPanel,
    CompositeScorePanel,
    PatternsPanel,
    MultiTFPanel,
    NewsPanel,
    PivotPointsPanel,
    MarketInfoPanel,
    OrderbookPanel,
    SignalHistoryPanel,
    RiskPanel,
    TradingSessionsPanel,
    MacroCalendarPanel,
} from '@/components/dashboard/panels';
import { useTranslation } from 'react-i18next';

const fadeUp = (delay = 0) => ({
	initial: { opacity: 0, y: 18 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: 0.42, ease: 'easeOut', delay },
});

export default function DashboardPage() {
	const { t } = useTranslation();

	return (
		<MarketProvider>
			<DashboardLayout title={t('dashboard.title')}>
				<div className="w-full min-w-0 space-y-4">
					{/* ── Zone 1: Instrument bar ──────────────────────────── */}
					<motion.div {...fadeUp(0)}>
						<div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 backdrop-blur-sm px-4 py-2.5">
							<InstrumentSelector />
						</div>
					</motion.div>

					{/* ── Zone 2: Chart (2/3) · AI panel (1/3) ───────────── */}
					<div className="grid grid-cols-3 gap-4 items-start">
						<motion.div
							{...fadeUp(0.07)}
							className="col-span-2 min-w-0"
						>
							<TradingChart />
						</motion.div>
						<motion.div
							{...fadeUp(0.1)}
							className="col-span-1 min-w-0"
						>
							<AiSignalPanel />
						</motion.div>
					</div>

					{/* ── Zone 3: Metrics strip (4 equal) ─────────────────── */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						<motion.div {...fadeUp(0.15)} className="min-w-0">
							<CompositeScorePanel />
						</motion.div>
						<motion.div {...fadeUp(0.18)} className="min-w-0">
							<TrendMetersPanel />
						</motion.div>
						<motion.div {...fadeUp(0.21)} className="min-w-0">
							<MarketInfoPanel />
						</motion.div>
						<motion.div {...fadeUp(0.24)} className="min-w-0">
							<MultiTFPanel />
						</motion.div>
					</div>

					{/* ── Zone 4: Analysis (3 equal) + Risk ─────────────────── */}
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
						<motion.div {...fadeUp(0.28)} className="min-w-0">
							<IndicatorsPanel />
						</motion.div>
						<motion.div {...fadeUp(0.31)} className="min-w-0">
							<PatternsPanel />
						</motion.div>
						<motion.div
							{...fadeUp(0.34)}
							className="min-w-0 flex flex-col gap-4"
						>
							<PivotPointsPanel />
							<OrderbookPanel />
						</motion.div>
						<motion.div {...fadeUp(0.37)} className="min-w-0">
							<RiskPanel />
						</motion.div>
					</div>

					{/* ── Zone 5: Sessions (1) · Macro (2) · News (1) ────── */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
						<motion.div {...fadeUp(0.38)} className="min-w-0">
							<TradingSessionsPanel />
						</motion.div>
						<motion.div
							{...fadeUp(0.4)}
							className="col-span-2 min-w-0"
						>
							<MacroCalendarPanel />
						</motion.div>
						<motion.div {...fadeUp(0.42)} className="min-w-0">
							<NewsPanel />
						</motion.div>
					</div>

					{/* ── Zone 6: Signal history (full width) ────────────── */}
					<motion.div {...fadeUp(0.45)} className="min-w-0">
						<SignalHistoryPanel />
					</motion.div>
				</div>
			</DashboardLayout>
		</MarketProvider>
	);
}
