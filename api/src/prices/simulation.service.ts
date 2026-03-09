import { Injectable } from '@nestjs/common';

export const INSTRUMENTS = {
    'XAU/USD': {
        name: 'Gold',
        basePrice: 5100,
        volatility: 0.0008,
        decimals: 2,
    },
    'BTC/USD': {
        name: 'Bitcoin',
        basePrice: 96500,
        volatility: 0.002,
        decimals: 2,
    },
    'ETH/USD': {
        name: 'Ethereum',
        basePrice: 2750,
        volatility: 0.003,
        decimals: 2,
    },
    'EUR/USD': {
        name: 'Euro / US Dollar',
        basePrice: 1.07,
        volatility: 0.0003,
        decimals: 5,
    },
    'GBP/USD': {
        name: 'British Pound / US Dollar',
        basePrice: 1.28,
        volatility: 0.0003,
        decimals: 5,
    },
};

type Candle = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

@Injectable()
export class SimulationService {
    private state: Record<
        string,
        { lastKnownPrice: number; simulatedHistory: Candle[] }
    > = {} as any;

    constructor() {
        for (const s of Object.keys(INSTRUMENTS)) {
            const cfg = (INSTRUMENTS as any)[s];
            this.state[s] = {
                lastKnownPrice: cfg.basePrice,
                simulatedHistory: [],
            };
            this.initSimulatedHistory(s, 200);
        }
    }

    private generateSimulatedCandle(
        symbol: string,
        basePrice: number,
        index: number,
    ): Candle {
        const config: any =
            (INSTRUMENTS as any)[symbol] || (INSTRUMENTS as any)['XAU/USD'];
        const volatility = config.volatility;
        const trend = Math.sin(index * 0.05) * (volatility * 1.2);
        const noise = (Math.random() - 0.5) * 2 * volatility;
        const change = trend + noise;
        const open = basePrice;
        const close = parseFloat(
            (open * (1 + change)).toFixed(config.decimals),
        );
        const high = parseFloat(
            (
                Math.max(open, close) *
                (1 + Math.random() * volatility * 0.5)
            ).toFixed(config.decimals),
        );
        const low = parseFloat(
            (
                Math.min(open, close) *
                (1 - Math.random() * volatility * 0.5)
            ).toFixed(config.decimals),
        );
        const volume = Math.floor(Math.random() * 1000 + 500);
        return {
            open: parseFloat(open.toFixed(config.decimals)),
            high,
            low,
            close,
            volume,
            time: Math.floor(Date.now() / 1000),
        };
    }

    initSimulatedHistory(symbol: string, count = 200) {
        const state = this.state[symbol];
        const cfg: any =
            (INSTRUMENTS as any)[symbol] || (INSTRUMENTS as any)['XAU/USD'];
        state.simulatedHistory = [];
        let price = state.lastKnownPrice * (1 - 0.005);
        for (let i = 0; i < count; i++) {
            const c = this.generateSimulatedCandle(symbol, price, i);
            state.simulatedHistory.push(c);
            price = c.close;
        }
        state.lastKnownPrice = price;
        return state.simulatedHistory;
    }

    addSimulatedCandle(symbol: string) {
        const state = this.state[symbol];
        const candle = this.generateSimulatedCandle(
            symbol,
            state.lastKnownPrice,
            state.simulatedHistory.length,
        );
        state.lastKnownPrice = candle.close;
        state.simulatedHistory.push(candle);
        if (state.simulatedHistory.length > 500) state.simulatedHistory.shift();
        return candle;
    }

    getLastPrice(symbol: string) {
        const st = this.state[symbol];
        if (!st) return null;
        return { price: st.lastKnownPrice, timestamp: Date.now() };
    }

    getHistory(symbol: string) {
        const st = this.state[symbol];
        return st?.simulatedHistory || [];
    }
}
