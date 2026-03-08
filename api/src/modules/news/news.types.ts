export type NewsAsset = 'XAU' | 'BTC' | 'ETH' | 'MACRO';

export interface INew {
    id: string;
    title: string;
    description: string;
    url: string;
    timestamp: Date;
    source: string;
    asset: NewsAsset;
    rawImpact?: string;
}

export interface INewClassificationResult {
    label: string; // Ex: 'BULLISH_GOLD', 'BEARISH_BTC', etc.
    confidence: number; // Between 0 and 1
}
