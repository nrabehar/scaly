// ============================================
//  Volatility Indicators — Bollinger Bands, ATR, Keltner, BB Squeeze, Supertrend
// ============================================
import type { Candle } from '@/types/market';
import { clamp } from './helpers';
import { calcEMA } from './trend';

export function calcBollingerBands(
	closes: number[],
	period = 20,
	stdDev = 2,
) {
	if (closes.length < period) return null;
	const slice = closes.slice(-period);
	const sma = slice.reduce((a, b) => a + b, 0) / period;
	const variance =
		slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
	const sd = Math.sqrt(variance);
	return {
		upper: +(sma + stdDev * sd).toFixed(2),
		middle: +sma.toFixed(2),
		lower: +(sma - stdDev * sd).toFixed(2),
		bandwidth: +(((stdDev * sd * 2) / sma) * 100).toFixed(4),
	};
}

export function calcATR(candles: Candle[], period = 14): number | null {
	if (candles.length < period + 1) return null;
	const trs: number[] = [];
	for (let i = 1; i < candles.length; i++) {
		trs.push(
			Math.max(
				candles[i].high - candles[i].low,
				Math.abs(candles[i].high - candles[i - 1].close),
				Math.abs(candles[i].low - candles[i - 1].close),
			),
		);
	}
	let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
	for (let i = period; i < trs.length; i++)
		atr = (atr * (period - 1) + trs[i]) / period;
	return +atr.toFixed(2);
}

export function calcKeltnerChannels(
	candles: Candle[],
	period = 20,
	multiplier = 1.5,
) {
	if (!candles || candles.length < period + 1) return null;
	const closes = candles.map((c) => c.close);
	const emaArr = calcEMA(closes, period);
	const atr = calcATR(candles, period);
	if (!emaArr || atr === null) return null;
	const middle = emaArr[emaArr.length - 1];
	const upper = middle + atr * multiplier;
	const lower = middle - atr * multiplier;
	return {
		upper: +upper.toFixed(2),
		middle: +middle.toFixed(2),
		lower: +lower.toFixed(2),
		widthPct: +(((upper - lower) / (middle || 1)) * 100).toFixed(4),
	};
}

export function calcBBSqueeze(
	candles: Candle[],
	bb?: ReturnType<typeof calcBollingerBands> | null,
) {
	const closes = candles.map((c) => c.close);
	const bbVal = bb || calcBollingerBands(closes, 20, 2);
	const kc = calcKeltnerChannels(candles, 20, 1.5);
	if (!bbVal || !kc) return null;
	const bbW =
		bbVal.middle === 0
			? 0
			: ((bbVal.upper - bbVal.lower) / bbVal.middle) * 100;
	const kcW =
		kc.middle === 0 ? 0 : ((kc.upper - kc.lower) / kc.middle) * 100;
	const isSqueezing = bbVal.upper < kc.upper && bbVal.lower > kc.lower;
	return {
		isSqueezing,
		state: isSqueezing ? 'ON' : ('OFF' as const),
		bbWidth: +bbW.toFixed(4),
		kcWidth: +kcW.toFixed(4),
		intensity: +(
			kcW === 0 ? 0 : clamp(((kcW - bbW) / kcW) * 100, -100, 100)
		).toFixed(2),
		keltnerUpper: kc.upper,
		keltnerLower: kc.lower,
	};
}

/**
 * Supertrend — ATR trailing band, direction always BUY or SELL (never neutral).
 */
export function calcSupertrend(
	candles: Candle[],
	period = 10,
	multiplier = 3,
) {
	if (!candles || candles.length < Math.max(period + 2, 20)) return null;

	const trs: number[] = [];
	for (let i = 1; i < candles.length; i++) {
		trs.push(
			Math.max(
				candles[i].high - candles[i].low,
				Math.abs(candles[i].high - candles[i - 1].close),
				Math.abs(candles[i].low - candles[i - 1].close),
			),
		);
	}
	if (trs.length < period + 1) return null;

	const atrSeries: Array<number | null> = Array(candles.length).fill(
		null,
	);
	let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
	atrSeries[period] = atr;
	for (let i = period + 1; i < candles.length; i++) {
		atr = (atr * (period - 1) + trs[i - 1]) / period;
		atrSeries[i] = atr;
	}

	const finalUpper = Array(candles.length).fill(0);
	const finalLower = Array(candles.length).fill(0);
	const direction: Array<1 | -1> = Array(candles.length).fill(1);

	for (let i = period; i < candles.length; i++) {
		const atrVal = atrSeries[i];
		if (atrVal === null) continue;
		const hl2 = (candles[i].high + candles[i].low) / 2;
		const basicUpper = hl2 + multiplier * atrVal;
		const basicLower = hl2 - multiplier * atrVal;

		if (i === period) {
			finalUpper[i] = basicUpper;
			finalLower[i] = basicLower;
			direction[i] = candles[i].close >= basicLower ? 1 : -1;
			continue;
		}

		const prevUpper = finalUpper[i - 1];
		const prevLower = finalLower[i - 1];
		const prevClose = candles[i - 1].close;

		finalUpper[i] =
			basicUpper < prevUpper || prevClose > prevUpper
				? basicUpper
				: prevUpper;
		finalLower[i] =
			basicLower > prevLower || prevClose < prevLower
				? basicLower
				: prevLower;

		const prevDir = direction[i - 1];
		if (prevDir === -1 && candles[i].close > finalUpper[i])
			direction[i] = 1;
		else if (prevDir === 1 && candles[i].close < finalLower[i])
			direction[i] = -1;
		else direction[i] = prevDir;
	}

	const last = candles.length - 1;
	const dir = direction[last];
	const value = dir === 1 ? finalLower[last] : finalUpper[last];
	const distancePct =
		candles[last].close === 0
			? 0
			: ((candles[last].close - value) / candles[last].close) * 100;

	return {
		direction: dir === 1 ? 'UP' : ('DOWN' as const),
		signal: dir === 1 ? 'BUY' : ('SELL' as const),
		value: +value.toFixed(2),
		upper: +finalUpper[last].toFixed(2),
		lower: +finalLower[last].toFixed(2),
		distancePct: +distancePct.toFixed(2),
		period,
		multiplier,
	};
}
