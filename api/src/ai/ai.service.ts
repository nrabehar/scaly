import { Injectable, Logger } from '@nestjs/common';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { ConfigService } from '@nestjs/config';

type AiResult = { signal?: any; raw?: any } | null;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly gemini: GeminiProvider,
    private readonly groq: GroqProvider,
    private readonly openrouter: OpenRouterProvider,
    private readonly ollama: OllamaProvider,
    private readonly config: ConfigService,
  ) {}

  private extractText(res: any): string | null {
    try {
      if (!res) return null;
      if (typeof res === 'string') return res;
      // Gemini shape
      if (res?.candidates?.[0]?.content?.parts?.[0]?.text)
        return res.candidates[0].content.parts[0].text;
      // OpenAI-like
      if (res?.choices?.[0]?.message?.content)
        return res.choices[0].message.content;
      if (res?.choices?.[0]?.text) return res.choices[0].text;
      // Ollama
      if (res?.response) return res.response;
      // fallback stringify
      return JSON.stringify(res);
    } catch (e) {
      return null;
    }
  }

  private parseAIResponse(text?: string | null) {
    if (!text) return null;
    try {
      // try direct JSON
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('['))
        return JSON.parse(trimmed);
    } catch (e) {}
    // try to extract JSON object inside text
    const m = String(text).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  private async tryProvider(
    name: string,
    fn: () => Promise<any>,
  ): Promise<AiResult> {
    try {
      const raw = await fn();
      const text = this.extractText(raw);
      const parsed = this.parseAIResponse(text);
      if (parsed) return { signal: parsed, raw };
      return { raw };
    } catch (e) {
      this.logger.debug(`provider ${name} error: ${String(e)}`);
      return null;
    }
  }

  async callAI(prompt: string, requestedModel = 'auto') {
    this.logger.debug(
      `AI request model=${requestedModel} prompt=${String(prompt).slice(0, 200)}`,
    );

    const providers = [
      {
        id: 'gemini',
        fn: () => this.gemini.call(prompt, this.config.get('GEMINI_API_KEY')),
      },
      {
        id: 'groq',
        fn: () => this.groq.call(prompt, this.config.get('GROQ_API_KEY')),
      },
      {
        id: 'openrouter',
        fn: () =>
          this.openrouter.call(prompt, this.config.get('OPENROUTER_API_KEY')),
      },
      { id: 'ollama', fn: () => this.ollama.call(prompt) },
    ];

    // If a model is requested try it first
    if (requestedModel && requestedModel !== 'auto') {
      const p = providers.find((x) => x.id === requestedModel);
      if (p) {
        const result = await this.tryProvider(p.id, p.fn);
        if (result && result.signal)
          return { success: true, model: p.id, result };
      }
    }

    // Try providers in order until one returns a parsed signal
    for (const p of providers) {
      const r = await this.tryProvider(p.id, p.fn);
      if (r && r.signal) return { success: true, model: p.id, result: r };
    }

    return { success: false, reason: 'no_provider_response' } as any;
  }
}
