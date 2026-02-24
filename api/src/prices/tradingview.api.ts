import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

type TVRowData = Array<number | string | null>;
interface TradingViewRow {
  s: string;
  d: TVRowData;
}

export interface TradingViewTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  change?: number | null;
  volume?: number | null;
  timestamp?: number | null;
  provider: string;
  providerSymbol?: string | null;
  providerDescription?: string | null;
}

@Injectable()
export class TradingViewApi {
  private readonly logger = new Logger(TradingViewApi.name);
  private readonly XAU_TICKERS = [
    'CAPITALCOMEX:GOLD',
    'CAPITALCOMEX:XAUUSD',
    'CAPITALCOMEX:GOLDSPOT',
    'CAPITALCOM:GOLD',
    'CAPITALCOM:XAUUSD',
    'CAPITALCOM:GOLDSPOT',
    'FOREXCOM:XAUUSD',
    'FX_IDC:XAUUSD',
    'FXCM:XAUUSD',
    'GOLD:XAUUSD',
    'SPOTGOLD:XAUUSD',
    'OANDA:XAUUSD',
    'TVC:GOLD',
  ];
  private readonly XAU_PREFERREDS = [...this.XAU_TICKERS];
  private readonly TV_REGIONS = ['global', 'cfd', 'forex', 'crypto', 'stock'];
  private readonly CacheMS = 5000;
  private CacheTick: Record<
    string,
    { timestamp: number; data: TradingViewTick }
  > = {};

  constructor(private readonly httpService: HttpService) {}

  private toNumber(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private pickBestRow(rows: TradingViewRow[]): TradingViewRow | undefined {
    return rows
      .filter((r) => this.XAU_PREFERREDS.includes(r?.s || ''))
      .sort((a, b) => (Number(b?.d?.[5]) || 0) - (Number(a?.d?.[5]) || 0))[0];
  }

  private buildTickFromRow(
    row: TradingViewRow,
    region: string,
  ): TradingViewTick {
    const [
      closeRaw,
      openRaw,
      highRaw,
      lowRaw,
      changeRaw,
      volumeRaw,
      timestampRaw,
      description,
    ] = row.d || [];

    const close = this.toNumber(closeRaw) ?? 0;
    const open = this.toNumber(openRaw);
    const high = this.toNumber(highRaw);
    const low = this.toNumber(lowRaw);
    const change = this.toNumber(changeRaw);
    const volume = this.toNumber(volumeRaw);
    const timestamp = this.toNumber(timestampRaw);

    const spread = Math.max(close * 0.00008, 0.1);
    const bid = close - spread / 2;
    const ask = close + spread / 2;
    const price = (bid + ask) / 2;

    return {
      symbol: 'XAU/USD',
      price,
      bid,
      ask,
      spread,
      open,
      high,
      low,
      change,
      volume,
      timestamp,
      provider: `TradingView - ${region}`,
      providerSymbol: row?.s || null,
      providerDescription: (description as string) || null,
    };
  }

  async fetchTick(): Promise<TradingViewTick | null> {
    const cacheKey = `TV:XAU/USD`;
    const now = Date.now();

    const cached = this.CacheTick[cacheKey];
    if (cached && now - cached.timestamp < this.CacheMS) {
      this.logger.debug(`Using cached TradingView data for ${cacheKey}`);
      return cached.data;
    }

    const payload = {
      symbols: { tickers: this.XAU_PREFERREDS, query: { types: [] } },
      columns: [
        'close',
        'open',
        'high',
        'low',
        'change',
        'volume',
        'timestamp',
        'description',
      ],
    };

    for (const region of this.TV_REGIONS) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.post(
            `https://scanner.tradingview.com/${region}/scan`,
            payload,
            {
              headers: {
                'Content-Type': 'application/json',
                Origin: 'https://www.tradingview.com',
                Referer: 'https://www.tradingview.com/',
              },
            },
          ),
        );

        const rows: TradingViewRow[] = Array.isArray(data?.data)
          ? data.data
          : [];

        this.logger.debug(`TradingView ${region} - rows=${rows.length}`);

        const best = this.pickBestRow(rows);
        if (!best) continue;

        const tick = this.buildTickFromRow(best, region);

        this.CacheTick[cacheKey] = { timestamp: now, data: tick };
        this.logger.log(
          `TradingView ${region} - selected ${best.s} (vol=${Number(best.d?.[5]) || 0})`,
        );
        return tick;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(
          `Error fetching TradingView data for region ${region}: ${msg}`,
        );
      }
    }

    return null;
  }
}
