import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GeminiProvider {
    private readonly logger = new Logger(GeminiProvider.name);
    /** Epoch ms until which this provider is rate-limited and should be skipped. */
    private backoffUntil = 0;
    constructor(private readonly http: HttpService) {}

    async call(prompt: string, apiKey?: string) {
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not set — skipping');
            return null;
        }
        if (Date.now() < this.backoffUntil) {
            const waitSec = Math.ceil((this.backoffUntil - Date.now()) / 1000);
            this.logger.debug(
                `Gemini rate-limit backoff: ${waitSec}s remaining — skipping`,
            );
            return null;
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const body = {
            systemInstruction: {
                parts: [
                    {
                        text: 'You are an elite Smart Money Concepts (SMC) and price action analyst. You specialize in order blocks, fair value gaps (FVG/imbalances), liquidity sweeps, break of structure (BOS/CHoCH), inducement, and multi-timeframe confluence. You think like an institutional trader. Always respond ONLY with valid JSON — no markdown, no explanation outside the JSON object.',
                    },
                ],
            },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 900,
                responseMimeType: 'application/json',
            },
        };
        try {
            const res = await firstValueFrom(
                this.http.post(url, body, { timeout: 15000 }),
            );
            return res.data;
        } catch (e: any) {
            const body = e?.response?.data;
            const msg = body ? JSON.stringify(body) : String(e?.message ?? e);
            // Extract retry delay from Gemini RetryInfo
            if (e?.response?.status === 429) {
                const details: any[] = body?.error?.details ?? [];
                const retryInfo = details.find((d: any) =>
                    d['@type']?.includes('RetryInfo'),
                );
                const retryDelay = retryInfo?.retryDelay ?? '60s';
                const seconds = parseInt(String(retryDelay), 10) || 60;
                this.backoffUntil = Date.now() + (seconds + 5) * 1000;
                this.logger.warn(`Gemini 429 — backing off for ${seconds}s`);
            } else {
                this.logger.error(`Gemini call failed: ${msg}`);
            }
            return null;
        }
    }
}
