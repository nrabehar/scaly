import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GroqProvider {
    private readonly logger = new Logger(GroqProvider.name);
    /** Epoch ms until which this provider is rate-limited and should be skipped. */
    private backoffUntil = 0;
    constructor(private readonly http: HttpService) {}

    async call(prompt: string, apiKey?: string) {
        if (!apiKey) {
            this.logger.warn('GROQ_API_KEY not set — skipping');
            return null;
        }
        if (Date.now() < this.backoffUntil) {
            const waitSec = Math.ceil((this.backoffUntil - Date.now()) / 1000);
            this.logger.debug(
                `Groq rate-limit backoff: ${waitSec}s remaining — skipping`,
            );
            return null;
        }
        try {
            const res = await firstValueFrom(
                this.http.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model: 'llama-3.3-70b-versatile',
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
                        response_format: { type: 'json_object' },
                    },
                    {
                        headers: { Authorization: `Bearer ${apiKey}` },
                        timeout: 30000,
                    },
                ),
            );
            return res.data;
        } catch (e: any) {
            const body = e?.response?.data;
            const msg = body ? JSON.stringify(body) : String(e?.message ?? e);
            // Extract retry-after from the Groq error message (e.g. "Please try again in 5m22s")
            if (body?.error?.code === 'rate_limit_exceeded') {
                const match = String(body?.error?.message ?? '').match(
                    /(\d+)m(\d+(?:\.\d+)?)?s/,
                );
                const minutes = match ? parseInt(match[1], 10) : 5;
                const seconds = match?.[2] ? parseFloat(match[2]) : 0;
                this.backoffUntil =
                    Date.now() + (minutes * 60 + seconds) * 1000 + 5000;
                this.logger.warn(
                    `Groq 429 — backing off for ${minutes}m${seconds.toFixed(0)}s`,
                );
            } else {
                this.logger.error(`Groq call failed: ${msg}`);
            }
            return null;
        }
    }
}
