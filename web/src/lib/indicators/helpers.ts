// ============================================
//  Shared Helpers
// ============================================

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calcSMA(data: number[], period: number): number[] | null {
  if (data.length < period) return null;
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    result.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}
