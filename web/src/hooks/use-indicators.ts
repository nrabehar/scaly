import { useMemo } from 'react';
import { computeAll } from '@/lib/indicators';
import type { Candle } from '@/types/market';

export function useIndicators(candles: Candle[] | undefined | null) {
  return useMemo(() => {
    if (!candles || candles.length < 30) return null;
    return computeAll(candles);
  }, [candles]);
}
