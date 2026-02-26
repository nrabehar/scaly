import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GeminiProvider {
  constructor(private readonly http: HttpService) {}

  async call(prompt: string, apiKey?: string) {
    if (!apiKey) return null;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    };
    try {
      const res = await firstValueFrom(
        this.http.post(url, body, { timeout: 15000 }),
      );
      return res.data;
    } catch (e) {
      return null;
    }
  }
}
