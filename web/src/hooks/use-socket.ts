import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { publishLiveTick } from '@/lib/liveTickBus';
import type {
    PriceTick,
    OrderbookData,
    NewsItem,
    ScalpResult,
} from '@/types/market';

// Empty string = relative URL → Vite dev proxy forwards /socket.io to localhost:4000
// In production, served from the same origin as the API.
const SOCKET_URL = '';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

// Module-level singleton so React StrictMode double-mount doesn't create/destroy connections
let sharedSocket: Socket | null = null;
let socketRefCount = 0;

/** Returns (and lazily creates) the module-level shared socket instance. */
export function getSharedSocket(): Socket {
	// Cancel any pending release from StrictMode unmount
	if (releaseTimer) {
		clearTimeout(releaseTimer);
		releaseTimer = null;
	}
	if (!sharedSocket) {
		sharedSocket = io(SOCKET_URL, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
		});
	}
	socketRefCount++;
	return sharedSocket;
}

let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function releaseSharedSocket() {
	socketRefCount--;
	if (socketRefCount <= 0) {
		// Delay disconnect to allow StrictMode re-mount to reclaim the socket
		releaseTimer = setTimeout(() => {
			if (socketRefCount <= 0 && sharedSocket) {
				sharedSocket.disconnect();
				sharedSocket = null;
				socketRefCount = 0;
			}
		}, 200);
	}
}

export function useSocket(symbol: string) {
	const queryClient = useQueryClient();
	const socketRef = useRef<Socket | null>(null);
	const [status, setStatus] = useState<ConnectionStatus>('disconnected');
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [instruments, setInstruments] = useState<string[]>([]);

	/** Subscribe to a symbol AND immediately request a fresh signal. */
	const subscribe = useCallback((sym: string) => {
		socketRef.current?.emit('subscribe', { symbol: sym });
		socketRef.current?.emit('request-signal', { symbol: sym });
		setIsAnalyzing(true);
	}, []);

	useEffect(() => {
		const socket = getSharedSocket();
		socketRef.current = socket;

		const onConnect = () => {
			setStatus('connected');
			subscribe(symbol);
		};
		const onDisconnect = () => setStatus('disconnected');
		const onReconnectAttempt = () => setStatus('connecting');

		// Server sends `connected` with instruments list on initial handshake
		const onConnectedEvent = (payload: { instruments?: string[] }) => {
			if (Array.isArray(payload?.instruments)) {
				setInstruments(payload.instruments);
			}
		};

		const onPrice = (payload: { symbol: string; data: PriceTick }) => {
			queryClient.setQueryData(
				['price', payload.symbol],
				payload.data,
			);
			// Publish to liveTickBus for zero-overhead consumers (chart, etc.)
			if (payload.data) {
				publishLiveTick({
					symbol: payload.symbol,
					price: payload.data.price,
					bid: payload.data.bid,
					ask: payload.data.ask,
					timestamp: payload.data.timestamp ?? Date.now(),
				});
			}
		};
		const onOrderbook = (payload: {
			symbol: string;
			data: OrderbookData;
		}) => {
			queryClient.setQueryData(
				['orderbook', payload.symbol],
				payload.data,
			);
		};
		const onNews = (payload: {
			symbol: string;
			data: NewsItem | NewsItem[];
		}) => {
			queryClient.setQueryData(
				['news-ws', payload.symbol],
				payload.data,
			);
		};
		const onAnalyzing = (payload: { symbol: string }) => {
			if (payload.symbol === symbol) setIsAnalyzing(true);
		};

		const onHold = (payload: {
			symbol: string;
			reason: string;
			ts: number;
		}) => {
			queryClient.setQueryData(['signal-hold', payload.symbol], {
				reason: payload.reason,
				ts: payload.ts,
			});
			if (payload.symbol === symbol) setIsAnalyzing(false);
		};

		const onSignal = (payload: {
			symbol: string;
			data: ScalpResult & { id: number };
		}) => {
			queryClient.setQueryData(
				['signal-live', payload.symbol],
				payload.data,
			);
			// Clear hold state when a real signal arrives
			queryClient.removeQueries({
				queryKey: ['signal-hold', payload.symbol],
			});
			// Clear loading state when the signal for the current symbol arrives
			if (payload.symbol === symbol) setIsAnalyzing(false);
		};

		const onSignalResolved = (payload: {
			id: number;
			symbol: string;
			outcome: string;
		}) => {
			queryClient.invalidateQueries({
				queryKey: ['signal-accuracy'],
			});
			queryClient.invalidateQueries({
				queryKey: ['signal-history', payload.symbol],
			});
		};

		const onPong = () => {
			// Server acknowledged our heartbeat — connection is alive
		};

		socket.on('connect', onConnect);
		socket.on('connected', onConnectedEvent);
		socket.on('disconnect', onDisconnect);
		socket.on('reconnect_attempt', onReconnectAttempt);
		socket.on('price', onPrice);
		socket.on('orderbook', onOrderbook);
		socket.on('news', onNews);
		socket.on('signal-analyzing', onAnalyzing);
		socket.on('signal-hold', onHold);
		socket.on('signal', onSignal);
		socket.on('signal-resolved', onSignalResolved);
		socket.on('pong', onPong);
		return () => {
			socket.off('connect', onConnect);
			socket.off('connected', onConnectedEvent);
			socket.off('disconnect', onDisconnect);
			socket.off('reconnect_attempt', onReconnectAttempt);
			socket.off('price', onPrice);
			socket.off('orderbook', onOrderbook);
			socket.off('news', onNews);
			socket.off('signal-analyzing', onAnalyzing);
			socket.off('signal-hold', onHold);
			socket.off('signal', onSignal);
			socket.off('signal-resolved', onSignalResolved);
			socket.off('pong', onPong);
			socketRef.current = null;
			releaseSharedSocket();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Re-subscribe + request immediate signal when symbol changes
	useEffect(() => {
		if (status === 'connected') {
			subscribe(symbol);
		}
	}, [symbol, status, subscribe]);

	// Auto-clear analyzing state after 30s as a safety fallback
	// (in case the backend returns HOLD and sends no signal event)
	useEffect(() => {
		if (!isAnalyzing) return;
		const t = setTimeout(() => setIsAnalyzing(false), 30_000);
		return () => clearTimeout(t);
	}, [isAnalyzing]);

	return { status, isAnalyzing, instruments };
}
