import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type {
  PriceTick,
  Candle,
  OrderbookData,
  NewsItem,
  MultiTFData,
  AiSignalResponse,
  ScalpResult,
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
			apiGet('/api/history', {
				symbol,
				interval,
				outputsize: limit,
			}),
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
		refetchInterval: 10_000,
		staleTime: 10_000,
	});
}

// ────────── Multi-Timeframe ──────────
export function useMultiTF(symbol: string) {
	return useQuery<MultiTFData>({
		queryKey: ['multi-tf', symbol],
		queryFn: () => apiGet('/api/multi-tf', { symbol }),
		refetchInterval: 10_000,
		staleTime: 10_000,
	});
}

// ────────── AI Signal (mutation) ──────────
export function useAiSignal() {
	const qc = useQueryClient();
	return useMutation<
		AiSignalResponse,
		Error,
		{ symbol: string; prompt: string; model?: string }
	>({
		mutationFn: (body) => apiPost('/api/ai-signal', body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['signal-history'] });
		},
	});
}

// ────────── Scalp 3-Min (mutation) ──────────
export function useScalp3m() {
	return useMutation<
		ScalpResult,
		Error,
		{ symbol: string; candles: Candle[] }
	>({
		mutationFn: (body) => apiPost('/api/scalp-3m', body),
	});
}

// ────────── Signal History ──────────
export function useSignalHistory(symbol?: string) {
	return useQuery<{ success: boolean; signals: SignalRecord[] }>({
		queryKey: ['signal-history', symbol],
		queryFn: () =>
			apiGet('/signals/history', symbol ? { symbol } : {}),
		refetchInterval: 10_000,
		staleTime: 5_000,
	});
}

// ────────── Signal Accuracy ──────────
export function useSignalAccuracy(symbol?: string) {
	return useQuery<SignalAccuracy & { success: boolean }>({
		queryKey: ['signal-accuracy', symbol],
		queryFn: () =>
			apiGet('/signals/accuracy', symbol ? { symbol } : {}),
		refetchInterval: 10_000,
		staleTime: 10_000,
	});
}

// ────────── Hold state (WS-pushed: why the engine is waiting) ──────────
export function useSignalHold(symbol: string) {
	return useQuery<{ reason: string; ts: number } | null>({
		queryKey: ['signal-hold', symbol],
		queryFn: () => null,
		enabled: false, // populated only via WS
		staleTime: Infinity,
	});
}

// ────────── Live Signal (REST seed on mount, then WS overrides) ──────────
export function useSignalLive(symbol: string) {
	return useQuery<ScalpResult & { id: number }>({
		queryKey: ['signal-live', symbol],
		queryFn: async () => {
			const res = await apiGet<{
				success: boolean;
				signals: SignalRecord[];
			}>('/signals/history', { symbol, limit: 1 });
			const rec = res.signals?.[0];
			if (!rec) throw new Error('no-signal');
			// Map SignalRecord → ScalpResult shape expected by the panel
			const meta = (rec.metadata ?? {}) as Record<string, unknown>;
			return {
				id: rec.id,
				symbol: rec.symbol,
				side: rec.signal as 'BUY' | 'SELL' | 'HOLD',
				score: rec.score ?? 0,
				confidence: (meta.confidence as number) ?? 0,
				reasons: (meta.reasons as string[]) ?? [],
				plan: (meta.plan as ScalpResult['plan']) ?? {
					entry: 0,
					tp: 0,
					sl: 0,
					rr: 0,
					atrVal: 0,
				},
				indicators:
					(meta.indicators as ScalpResult['indicators']) ?? {},
				smc: (meta.smc as ScalpResult['smc']) ?? {},
				mtfBias:
					(meta.mtfBias as ScalpResult['mtfBias']) ?? 'NEUTRAL',
				mode: (meta.mode as ScalpResult['mode']) ?? undefined,
			} satisfies ScalpResult & { id: number };
		},
		// WS handler overwrites this cache entry via queryClient.setQueryData —
		// staleTime=Infinity means it won't auto-refetch and clobber the live data.
		enabled: !!symbol,
		staleTime: Infinity,
		retry: false,
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
