// ============================================
//  Market Data Types
// ============================================

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  time: number | string;
}

export interface PriceTick {
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
  source: string;
  symbol?: string;
  success?: boolean;
}

export interface OrderbookLevel {
  0: number; // price
  1: number; // quantity
}

export interface OrderbookData {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  ts: number;
}

export interface NewsItem {
  title: string;
  summary?: string;
  link?: string;
  source?: string;
  pubDate?: string;
  ts?: number;
  sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact?: 'HIGH' | 'MEDIUM' | 'LOW';
  relevance?: number;
}

export interface Instrument {
  symbol: string;
  name: string;
  type: 'forex' | 'crypto';
  emoji: string;
  marketHours?: {
    closedFrom?: string;
    closedTo?: string;
  };
}

export interface AiSignalResponse {
  success: boolean;
  model?: string;
  parsed?: {
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    side?: 'BUY' | 'SELL' | 'HOLD';
    confidence?: number;
    score?: number;
  };
  saved?: unknown;
  reason?: string;
}

export interface ScalpPrediction {
  success: boolean;
  symbol?: string;
  prediction?: {
    side: 'BUY' | 'SELL' | 'HOLD';
    entry: number;
    tp: number;
    sl: number;
    confidence: number;
    reasons: string[];
  };
  reason?: string;
}

export interface SignalRecord {
  id: number;
  symbol: string;
  provider?: string;
  signal: string;
  score?: number;
  metadata?: Record<string, unknown>;
  resolved?: boolean;
  createdAt: string;
}

export interface SignalAccuracy {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  pending: number;
}

export interface MultiTFFrame {
  success: boolean;
  data?: Candle[];
  reason?: string;
}

export interface MultiTFData {
  success: boolean;
  symbol: string;
  frames: Record<string, MultiTFFrame>;
}

export type SymbolType = 'XAU/USD' | 'BTC/USD' | 'ETH/USD';
export type TimeframeType =
  | '1s' | '5s' | '15s' | '30s'
  | '1min' | '5min' | '15min' | '1h' | '4h' | '1D';

export interface MarketContextState {
  currentSymbol: SymbolType;
  setCurrentSymbol: (symbol: SymbolType) => void;
  currentTimeframe: TimeframeType;
  setCurrentTimeframe: (tf: TimeframeType) => void;
  selectedAiModel: string;
  setSelectedAiModel: (model: string) => void;
}
