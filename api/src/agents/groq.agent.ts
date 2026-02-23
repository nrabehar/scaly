import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodeFetch from 'node-fetch';

@Injectable()
export class GroqAgent {
  constructor(private readonly configService: ConfigService) {}
  async call(prompt: string) {
    const apiKey = this.configService.get('agent.groqApiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException('Api key not found');
    }
    const res = await nodeFetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content:
                'Tu es un expert en analyse technique de trading. Réponds UNIQUEMENT en JSON valide avec details.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      },
    );
    return await res.json();
  }
}
