import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { GroqAgent } from './groq.agent';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, GroqAgent],
})
export class AgentsModule {}
