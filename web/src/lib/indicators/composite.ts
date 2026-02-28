// ============================================
//  Composite Indicators — Pro Combo Confluence
// ============================================
import { clamp } from './helpers';

function makeBlock(bias: number, reasons: string[]) {
  const score = clamp(Math.round((bias + 100) / 2), 0, 100);
  const signal = score >= 60 ? 'BUY' : score <= 40 ? 'SELL' : 'NEUTRAL';
  return { score, signal, reasons };
}

export function calculateProCombo(candles: unknown[], indicators: Record<string, any>, currentPrice: number) {
  const atr = indicators.atr || 0;

  // ── Trend Block ──
  const tR: string[] = [];
  let tB = 0;
  if (indicators.ema9 != null && indicators.ema21 != null) {
    if (indicators.ema9 > indicators.ema21) { tB += 30; tR.push('EMA 9/21 bullish'); }
    else { tB -= 30; tR.push('EMA 9/21 bearish'); }
  }
  if (indicators.ichimoku?.signal === 'BULLISH') { tB += 35; tR.push('Ichimoku bullish'); }
  else if (indicators.ichimoku?.signal === 'BEARISH') { tB -= 35; tR.push('Ichimoku bearish'); }
  const trend = makeBlock(tB, tR);

  // ── Momentum Block ──
  const mR: string[] = [];
  let mB = 0;
  if (indicators.rsiDivergence?.signal === 'BULLISH') { mB += 35; mR.push('RSI bullish div'); }
  else if (indicators.rsiDivergence?.signal === 'BEARISH') { mB -= 35; mR.push('RSI bearish div'); }
  if (indicators.stochRsi?.signal === 'BULLISH') { mB += 25; mR.push('StochRSI bullish'); }
  else if (indicators.stochRsi?.signal === 'BEARISH') { mB -= 25; mR.push('StochRSI bearish'); }
  if (indicators.rsi != null) {
    if (indicators.rsi > 55) mB += 15; else if (indicators.rsi < 45) mB -= 15;
  }
  const momentum = makeBlock(mB, mR);

  // ── Volume Block ──
  const vR: string[] = [];
  let vB = 0;
  if (indicators.obv?.trend === 'UP') { vB += 20; vR.push('OBV rising'); }
  else if (indicators.obv?.trend === 'DOWN') { vB -= 20; vR.push('OBV falling'); }
  if (indicators.cvd?.trend === 'UP') { vB += 20; vR.push('CVD positive'); }
  else if (indicators.cvd?.trend === 'DOWN') { vB -= 20; vR.push('CVD negative'); }
  if (indicators.volumeProfile?.skew === 'BUY') { vB += 20; vR.push('VP buy-side'); }
  else if (indicators.volumeProfile?.skew === 'SELL') { vB -= 20; vR.push('VP sell-side'); }
  if (indicators.volumeProfile?.poc) {
    if (currentPrice > indicators.volumeProfile.poc) vB += 10; else vB -= 10;
  }
  const volume = makeBlock(vB, vR);

  // ── Volatility Block ──
  const volR: string[] = [];
  let volB = 0;
  if (indicators.bbSqueeze?.isSqueezing) {
    volR.push('BB squeeze active');
    if (trend.signal === 'BUY') volB += 15; else if (trend.signal === 'SELL') volB -= 15;
  } else {
    if (indicators.bbUpper != null && currentPrice > indicators.bbUpper) { volB += 20; volR.push('Above BB upper'); }
    else if (indicators.bbLower != null && currentPrice < indicators.bbLower) { volB -= 20; volR.push('Below BB lower'); }
  }
  if (atr > 0) volR.push(`ATR ${((atr / currentPrice) * 100).toFixed(2)}%`);
  const volatility = makeBlock(volB, volR);

  // ── Structure Block ──
  const sR: string[] = [];
  let sB = 0;
  const bullOB = (indicators.orderBlocks || []).filter((z: any) => z.type === 'BULLISH').sort((a: any, b: any) => a.age - b.age)[0];
  const bearOB = (indicators.orderBlocks || []).filter((z: any) => z.type === 'BEARISH').sort((a: any, b: any) => a.age - b.age)[0];
  if (bullOB && currentPrice >= bullOB.low - atr * 0.6 && currentPrice <= bullOB.high + atr * 0.6) { sB += 25; sR.push('Near bullish OB'); }
  if (bearOB && currentPrice >= bearOB.low - atr * 0.6 && currentPrice <= bearOB.high + atr * 0.6) { sB -= 25; sR.push('Near bearish OB'); }

  const bullFVG = (indicators.fvgs || []).filter((z: any) => z.type === 'BULLISH').sort((a: any, b: any) => a.age - b.age)[0];
  const bearFVG = (indicators.fvgs || []).filter((z: any) => z.type === 'BEARISH').sort((a: any, b: any) => a.age - b.age)[0];
  if (bullFVG && currentPrice >= bullFVG.low && currentPrice <= bullFVG.high + atr * 0.4) { sB += 20; sR.push('In bullish FVG'); }
  if (bearFVG && currentPrice <= bearFVG.high && currentPrice >= bearFVG.low - atr * 0.4) { sB -= 20; sR.push('In bearish FVG'); }

  if (indicators.fibonacci?.inGoldenPocket) {
    if (indicators.fibonacci.trend === 'UP') { sB += 20; sR.push('Fib golden pocket uptrend'); }
    else if (indicators.fibonacci.trend === 'DOWN') { sB -= 20; sR.push('Fib golden pocket downtrend'); }
  }
  const structure = makeBlock(sB, sR);

  // ── Confirmation Block ──
  const cR: string[] = [];
  let cB = 0;
  if (indicators.mtfConfluence) {
    cR.push(`MTF ${indicators.mtfConfluence.signal} (${indicators.mtfConfluence.strength}%)`);
    if (indicators.mtfConfluence.signal === 'BUY') cB += Math.round(indicators.mtfConfluence.strength * 0.6);
    else if (indicators.mtfConfluence.signal === 'SELL') cB -= Math.round(indicators.mtfConfluence.strength * 0.6);
  }
  const confirmation = makeBlock(cB, cR);

  // ── Weighted Score ──
  const w = { trend: 0.22, momentum: 0.18, volume: 0.18, volatility: 0.12, structure: 0.18, confirmation: 0.12 };
  const score = Math.round(
    trend.score * w.trend + momentum.score * w.momentum + volume.score * w.volume +
    volatility.score * w.volatility + structure.score * w.structure + confirmation.score * w.confirmation,
  );

  const signal = score >= 60 ? 'BUY' : score <= 40 ? 'SELL' : 'HOLD';

  return {
    score,
    signal,
    blocks: { trend, momentum, volume, volatility, structure, confirmation },
    summary: [
      `Trend ${trend.signal} (${trend.score})`,
      `Momentum ${momentum.signal} (${momentum.score})`,
      `Volume ${volume.signal} (${volume.score})`,
      `Volatility ${volatility.signal} (${volatility.score})`,
      `Structure ${structure.signal} (${structure.score})`,
      `MTF ${confirmation.signal} (${confirmation.score})`,
    ],
  };
}
