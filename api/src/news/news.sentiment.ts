import {
  BEARISH_NEWS_KEYWORDS,
  BULLISH_NEWS_KEYWORDS,
  IMPACT_NEWS_KEYWORDS,
} from './news.constant';

export type NewsSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type NewsImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text: string, phrase: string) {
  if (!phrase) return 0;
  const re = new RegExp(escapeRegExp(phrase), 'gi');
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

export const analyzeSentiment = (
  title: string,
  description: string = '',
): {
  sentiment: NewsSentiment;
  score: number;
  impact: NewsImpactLevel;
  bullScore: number;
  bearScore: number;
} => {
  const text = `${title} ${description}`.toLowerCase();

  // Count occurrences for multi-word phrases and single-keywords (using Sets)
  let bullScore = 0;
  for (const kw of BULLISH_NEWS_KEYWORDS) {
    const occurrences = countOccurrences(text, kw);
    if (occurrences === 0) continue;
    const weight = kw.includes(' ') ? 2 : 1;
    bullScore += weight * occurrences;
  }

  let bearScore = 0;
  for (const kw of BEARISH_NEWS_KEYWORDS) {
    const occurrences = countOccurrences(text, kw);
    if (occurrences === 0) continue;
    const weight = kw.includes(' ') ? 2 : 1;
    bearScore += weight * occurrences;
  }

  let impactCount = 0;
  for (const kw of IMPACT_NEWS_KEYWORDS) {
    impactCount += countOccurrences(text, kw);
  }

  const sentiment: NewsSentiment =
    bullScore > bearScore
      ? 'BULLISH'
      : bearScore > bullScore
        ? 'BEARISH'
        : 'NEUTRAL';

  const score =
    sentiment === 'BULLISH'
      ? Math.min(bullScore * 15, 100)
      : sentiment === 'BEARISH'
        ? -Math.min(bearScore * 15, 100)
        : 0;

  const impact: NewsImpactLevel =
    impactCount >= 3 ? 'HIGH' : impactCount >= 1 ? 'MEDIUM' : 'LOW';

  return { sentiment, score, impact, bullScore, bearScore };
};
