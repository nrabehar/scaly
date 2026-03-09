import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OpenRouterProvider {
    constructor(private readonly http: HttpService) {}

    async call(prompt: string, apiKey?: string) {
        if (!apiKey) return null;
        try {
            const res = await firstValueFrom(
                this.http.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    {
                        model: 'mistralai/mixtral-8x7b-instruct',
                        messages: [
                            {
                                role: 'system',
                                content:
                                    'You are an elite Smart Money Concepts (SMC) and price action analyst. You specialize in order blocks, fair value gaps (FVG/imbalances), liquidity sweeps, break of structure (BOS/CHoCH), inducement, and multi-timeframe confluence. You think like an institutional trader. Respond ONLY with valid JSON — no markdown fences, no text outside the JSON object.',
                            },
                            { role: 'user', content: prompt },
                        ],
                        temperature: 0.25,
                        max_tokens: 900,
                    },
                    {
                        headers: { Authorization: `Bearer ${apiKey}` },
                        timeout: 15000,
                    },
                ),
            );
            return res.data;
        } catch (e: any) {
            const msg = e?.response?.data
                ? JSON.stringify(e.response.data)
                : String(e?.message ?? e);
            // eslint-disable-next-line no-console
            console.error(`[OpenRouterProvider] call failed: ${msg}`);
            return null;
        }
    }
}
