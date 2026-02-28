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
} from '@/components/dashboard/panels';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation();

  return (
    <MarketProvider>
      <DashboardLayout title={t('dashboard.title')}>
        <div className="space-y-4">
          {/* Top bar: Instrument selector */}
          <InstrumentSelector />

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column: Chart (spans 2 cols) */}
            <TradingChart />

            {/* Right column: AI + Composite + Market Info */}
            <div className="space-y-4">
              <AiSignalPanel />
              <CompositeScorePanel />
              <MarketInfoPanel />
            </div>
          </div>

          {/* Secondary grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorsPanel />
            <TrendMetersPanel />
            <PatternsPanel />
            <div className="space-y-4">
              <PivotPointsPanel />
              <OrderbookPanel />
            </div>
          </div>

          {/* Third row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MultiTFPanel />
            <NewsPanel />
          </div>

          {/* Signal history (full width) */}
          <SignalHistoryPanel />
        </div>
      </DashboardLayout>
    </MarketProvider>
  );
}
