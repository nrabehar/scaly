import { Injectable } from '@nestjs/common';
import { GroqAgent } from './groq.agent';

@Injectable()
export class AgentsService {
  constructor(private readonly grok: GroqAgent) {}

  async askAgent(prompt: string) {
    return this.grok.call(prompt);
  }
}
