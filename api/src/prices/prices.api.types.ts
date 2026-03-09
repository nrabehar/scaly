export type MarketPair =
    | 'XAU/USD'
    | 'BTC/USD'
    | 'ETH/USD'
    | 'EUR/USD'
    | 'GBP/USD';

export interface Price {
    price: number;
    bid: number;
    ask: number;
    spread: number;
    volume: number;
    timestamp: number;
}

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface CandleHistory {
    data: Candle[];
    timestamp: number;
}

export interface IPriceAPI {
    fetchTick: (symbol: MarketPair) => Promise<Price | null>;
    fetchHistory: (
        symbol: MarketPair,
        timeval?: string,
        outputSize?: number,
    ) => Promise<Candle[]>;
}
