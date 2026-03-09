import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OllamaProvider {
    constructor(private readonly http: HttpService) {}

    async call(prompt: string) {
        const SYSTEM =
            'You are an elite Smart Money Concepts (SMC) and price action analyst. You specialize in order blocks, fair value gaps (FVG/imbalances), liquidity sweeps, break of structure (BOS/CHoCH), inducement, and multi-timeframe confluence. You think like an institutional trader. Respond ONLY with valid JSON — no markdown fences, no text outside the JSON object.';
        try {
            const res = await firstValueFrom(
                this.http.post(
                    'http://localhost:11434/api/chat',
                    {
                        model: 'gemma3:4b',
                        messages: [
                            { role: 'system', content: SYSTEM },
                            { role: 'user', content: prompt },
                        ],
                        stream: false,
                        format: 'json',
                        options: { temperature: 0.25 },
                    },
                    { timeout: 30000 },
                ),
            );
            return res.data;
        } catch (e: any) {
            // Ollama is optional — only log if it seems to be running
            if (!String(e?.message ?? e).includes('ECONNREFUSED')) {
                // eslint-disable-next-line no-console
                console.error(
                    `[OllamaProvider] call failed: ${String(e?.message ?? e)}`,
                );
            }
            return null;
        }
    }
}
