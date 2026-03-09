import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MarketContextState, SymbolType, TimeframeType } from '@/types/market';

const MarketContext = createContext<MarketContextState | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [currentSymbol, setCurrentSymbol] = useState<SymbolType>('BTC/USD');
  const [currentTimeframe, setCurrentTimeframe] = useState<TimeframeType>('1min');
  const [selectedAiModel, setSelectedAiModel] = useState<string>('auto');

  return (
    <MarketContext.Provider
      value={{
        currentSymbol,
        setCurrentSymbol,
        currentTimeframe,
        setCurrentTimeframe,
        selectedAiModel,
        setSelectedAiModel,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within a MarketProvider');
  return ctx;
}
