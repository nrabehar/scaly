import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type {
  PriceTick,
  Candle,
  OrderbookData,
  NewsItem,
  MultiTFData,
  AiSignalResponse,
  ScalpPrediction,
  SignalRecord,
  SignalAccuracy,
  Instrument,
} from '@/types/market';

// ────────── Price (WS-first, HTTP fallback) ──────────
export function usePrice(symbol: string) {
  return useQuery<PriceTick>({
    queryKey: ['price', symbol],
    queryFn: () => apiGet<PriceTick>('/api/price', { symbol }),
    refetchInterval: 5000,
    staleTime: 2000,
  });
}

// ────────── Candle History ──────────
export function useHistory(symbol: string, interval: string, limit = 200) {
  return useQuery<{ success: boolean; data: Candle[] }>({
    queryKey: ['history', symbol, interval, limit],
    queryFn: () =>
      apiGet('/api/history', { symbol, interval, outputsize: limit }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ────────── Orderbook (WS-first, HTTP fallback) ──────────
export function useOrderbook(symbol: string) {
  return useQuery<OrderbookData>({
    queryKey: ['orderbook', symbol],
    queryFn: async () => {
      const res = await apiGet<{ success: boolean } & OrderbookData>(
        '/api/orderbook',
        { symbol },
      );
      return res;
    },
    refetchInterval: 10_000,
    staleTime: 4000,
    enabled: symbol === 'BTC/USD' || symbol === 'ETH/USD',
  });
}

// ────────── News (WS-first, HTTP fallback) ──────────
export function useNews(symbol: string) {
  return useQuery<{ success: boolean; items: NewsItem[] }>({
    queryKey: ['news', symbol],
    queryFn: () => apiGet('/api/news', { symbol }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ────────── Multi-Timeframe ──────────
export function useMultiTF(symbol: string) {
  return useQuery<MultiTFData>({
    queryKey: ['multi-tf', symbol],
    queryFn: () => apiGet('/api/multi-tf', { symbol }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

// ────────── AI Signal (mutation) ──────────
export function useAiSignal() {
  const qc = useQueryClient();
  return useMutation<AiSignalResponse, Error, { symbol: string; prompt: string; model?: string }>({
    mutationFn: (body) => apiPost('/api/ai-signal', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signal-history'] });
    },
  });
}

// ────────── Scalp 3-Min (mutation) ──────────
export function useScalp3m() {
  return useMutation<ScalpPrediction, Error, { symbol: string; candles: Candle[] }>({
    mutationFn: (body) => apiPost('/api/scalp-3m', body),
  });
}

// ────────── Signal History ──────────
export function useSignalHistory(symbol?: string) {
  return useQuery<{ success: boolean; signals: SignalRecord[] }>({
    queryKey: ['signal-history', symbol],
    queryFn: () => apiGet('/api/signal-history', symbol ? { symbol } : {}),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

// ────────── Signal Accuracy ──────────
export function useSignalAccuracy(symbol?: string) {
  return useQuery<SignalAccuracy & { success: boolean }>({
    queryKey: ['signal-accuracy', symbol],
    queryFn: () => apiGet('/api/signal-accuracy', symbol ? { symbol } : {}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ────────── Instruments (static) ──────────
export function useInstruments() {
  return useQuery<{ success: boolean; instruments: Instrument[] }>({
    queryKey: ['instruments'],
    queryFn: () => apiGet('/api/instruments'),
    staleTime: Infinity,
  });
}
