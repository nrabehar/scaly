import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OllamaProvider {
  constructor(private readonly http: HttpService) {}

  async call(prompt: string) {
    try {
      const res = await firstValueFrom(
        this.http.post(
          'http://localhost:11434/api/generate',
          { model: 'gemma3:4b', prompt, stream: false, format: 'json' },
          { timeout: 30000 },
        ),
      );
      return res.data;
    } catch (e) {
      return null;
    }
  }
}
