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
                  'Tu es un expert en analyse technique de trading. Réponds UNIQUEMENT en JSON valide.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 },
        ),
      );
      return res.data;
    } catch (e) {
      return null;
    }
  }
}
