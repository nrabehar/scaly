import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GroqProvider {
  constructor(private readonly http: HttpService) {}

  async call(prompt: string, apiKey?: string) {
    if (!apiKey) return null;
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
                  'Tu es un expert en analyse technique de trading. Réponds UNIQUEMENT en JSON valide.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: 'json_object' },
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 },
        ),
      );
      return res.data;
    } catch (e) {
      return null;
    }
  }
}
