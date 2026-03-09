/**
 * liveTickBus — module-level pub/sub for real-time price ticks.
 *
 * Decouples the WebSocket layer from consumers (chart, mini-prices, etc.)
 * so that price updates flow instantly without React state or QueryClient
 * overhead on the hot path.
 *
 * Usage:
 *   // subscribe
 *   const unsub = subscribeLiveTick((tick) => { ... });
 *   // publish (done in use-socket.ts)
 *   publishLiveTick({ symbol: 'BTC/USD', price: 95000, timestamp: Date.now() });
 *   // cleanup
 *   unsub();
 */

export type LiveTick = {
	symbol: string;
	price: number;
	bid?: number;
	ask?: number;
	timestamp?: number;
};

type TickListener = (tick: LiveTick) => void;

const listeners = new Map<string, Set<TickListener>>();
const globalListeners = new Set<TickListener>();

/** Subscribe to ticks for a specific symbol. Returns an unsubscribe function. */
export function subscribeLiveTick(
	symbolOrListener: string | TickListener,
	listener?: TickListener,
): () => void {
	if (typeof symbolOrListener === 'function') {
		// Global subscriber — receives all symbols
		globalListeners.add(symbolOrListener);
		return () => globalListeners.delete(symbolOrListener);
	}

	const symbol = symbolOrListener;
	if (!listener)
		throw new Error('listener required when symbol is provided');

	if (!listeners.has(symbol)) listeners.set(symbol, new Set());
	listeners.get(symbol)!.add(listener);
	return () => {
		listeners.get(symbol)?.delete(listener);
	};
}

/** Publish a price tick — called by the WebSocket layer. */
export function publishLiveTick(tick: LiveTick): void {
	// Symbol-specific subscribers
	listeners.get(tick.symbol)?.forEach((fn) => {
		try {
			fn(tick);
		} catch {
			/* isolate listener errors */
		}
	});
	// Global subscribers
	globalListeners.forEach((fn) => {
		try {
			fn(tick);
		} catch {
			/* isolate listener errors */
		}
	});
}

/** Last known tick per symbol — allows late subscribers to get the latest price */
const lastTicks = new Map<string, LiveTick>();

export function getLastTick(symbol: string): LiveTick | undefined {
	return lastTicks.get(symbol);
}

// Internal: keep lastTicks up to date
subscribeLiveTick((tick) => {
	lastTicks.set(tick.symbol, tick);
});
