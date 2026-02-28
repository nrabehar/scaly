// ============================================
//  Indicator Engine — Barrel Export + computeAll facade
// ============================================
import type { Candle } from '@/types/market';

// Re-exports
export { clamp, calcSMA } from './helpers';
export { calcEMA, calcADX, calcIchimoku, determineTrend, calcLocalMTFConfluence } from './trend';
export { calcRSI, calcRSISeries, calcMACD, calcStochastic, calcWilliamsR, calcCCI, calcStochRSI, detectRSIDivergence } from './momentum';
export { calcMFI, calcVWAP, calcOBV, calcCVD, calcVolumeProfile } from './volume';
export { calcBollingerBands, calcATR, calcKeltnerChannels, calcBBSqueeze } from './volatility';
export { calcPivotPoints, detectOrderBlocks, detectFVGs, calcFibonacciStructure, detectPatterns } from './structure';
export { calculateProCombo } from './composite';

// Imports for computeAll
import { calcEMA, calcADX, calcIchimoku, determineTrend, calcLocalMTFConfluence } from './trend';
import { calcRSI, calcRSISeries, calcMACD, calcStochastic, calcWilliamsR, calcCCI, calcStochRSI, detectRSIDivergence } from './momentum';
import { calcMFI, calcVWAP, calcOBV, calcCVD, calcVolumeProfile } from './volume';
import { calcBollingerBands, calcATR, calcKeltnerChannels, calcBBSqueeze } from './volatility';
import { calcPivotPoints, detectOrderBlocks, detectFVGs, calcFibonacciStructure, detectPatterns } from './structure';
import { calculateProCombo } from './composite';

export function computeAll(candles: Candle[]) {
  if (!candles || candles.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];

  const rsi = calcRSI(closes);
  const rsiSeries = calcRSISeries(closes);
  const macd = calcMACD(closes);
  const bb = calcBollingerBands(closes);
  const atr = calcATR(candles);
  const stochastic = calcStochastic(candles);
  const stochRsi = calcStochRSI(closes);
  const rsiDivergence = detectRSIDivergence(candles, rsiSeries);
  const adx = calcADX(candles);
  const williamsR = calcWilliamsR(candles);
  const cci = calcCCI(candles);
  const mfi = calcMFI(candles);
  const pivotPoints = calcPivotPoints(candles);
  const vwap = calcVWAP(candles);
  const obv = calcOBV(candles);
  const cvd = calcCVD(candles);
  const volumeProfile = calcVolumeProfile(candles, currentPrice);
  const keltner = calcKeltnerChannels(candles);
  const bbSqueeze = calcBBSqueeze(candles, bb);
  const ichimoku = calcIchimoku(candles, currentPrice);
  const orderBlocks = detectOrderBlocks(candles, atr);
  const fvgs = detectFVGs(candles);
  const fibonacci = calcFibonacciStructure(candles, currentPrice);
  const mtfConfluence = calcLocalMTFConfluence(candles);
  const patterns = detectPatterns(candles);

  const ema9a = calcEMA(closes, 9);
  const ema21a = calcEMA(closes, 21);
  const ema50a = calcEMA(closes, 50);
  const ema200a = calcEMA(closes, 200);

  const ema9 = ema9a ? +ema9a[ema9a.length - 1].toFixed(2) : null;
  const ema21 = ema21a ? +ema21a[ema21a.length - 1].toFixed(2) : null;
  const ema50 = ema50a ? +ema50a[ema50a.length - 1].toFixed(2) : null;
  const ema200 = ema200a ? +ema200a[ema200a.length - 1].toFixed(2) : null;

  const indicators: Record<string, any> = {
    rsi,
    macdLine: macd?.macdLine ?? null,
    macdSignal: macd?.signalLine ?? null,
    macdHistogram: macd?.histogram ?? null,
    bbUpper: bb?.upper ?? null,
    bbMiddle: bb?.middle ?? null,
    bbLower: bb?.lower ?? null,
    bbBandwidth: bb?.bandwidth ?? null,
    atr,
    stochastic,
    stochRsi,
    rsiDivergence,
    adx,
    williamsR,
    cci,
    mfi,
    pivotPoints,
    vwap,
    obv,
    cvd,
    volumeProfile,
    keltner,
    bbSqueeze,
    ichimoku,
    orderBlocks,
    fvgs,
    fibonacci,
    mtfConfluence,
    patterns,
    ema9, ema21, ema50, ema200,
    emaArrays: { ema9: ema9a, ema21: ema21a, ema50: ema50a, ema200: ema200a },
    trend: null as any,
    proCombo: null as any,
    compositeScore: 0,
    currentPrice,
  };

  indicators.trend = determineTrend(indicators, currentPrice);
  indicators.proCombo = calculateProCombo(candles, indicators, currentPrice);
  indicators.compositeScore = indicators.proCombo ? indicators.proCombo.score - 50 : indicators.trend.bullishPct - 50;

  return indicators;
}
