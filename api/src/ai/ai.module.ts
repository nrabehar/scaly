import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { HttpModule } from '@nestjs/axios';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { AiController } from './ai.controller';
import { SignalsModule } from '../signals/signals.module';

@Module({
  imports: [HttpModule.register({ timeout: 15000 }), SignalsModule],
  providers: [
    AiService,
    GeminiProvider,
    GroqProvider,
    OpenRouterProvider,
    OllamaProvider,
  ],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
