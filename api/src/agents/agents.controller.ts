import {
    Controller,
    Get,
    Post,
    Body,
    BadRequestException,
} from '@nestjs/common';
import { AgentsService, AgentTask } from './agents.service';

interface RunTaskBody {
    task: AgentTask;
    context: Record<string, unknown>;
    model?: string;
}

@Controller('agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) {}

    @Get()
    async sayHello() {
        return this.agentsService.askAgent(
            'Hello, describe yourself briefly as a trading AI assistant.',
        );
    }

    /**
     * POST /agents/task
     * Body: { task: 'market-analysis'|'risk-assessment'|'signal-validate'|'news-impact', context: {...}, model?: string }
     */
    @Post('task')
    async runTask(@Body() body: RunTaskBody) {
        const { task, context, model } = body;
        if (!task || !context) {
            throw new BadRequestException('task and context are required');
        }
        return this.agentsService.runTask(task, context, model ?? 'auto');
    }
}
