import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { GroqAgent } from './groq.agent';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [AiModule],
    controllers: [AgentsController],
    providers: [AgentsService, GroqAgent],
    exports: [AgentsService],
})
export class AgentsModule {}
