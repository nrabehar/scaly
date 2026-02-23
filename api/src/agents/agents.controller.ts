import { Controller, Get } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async sayHello() {
    const res = await this.agentsService.askAgent('Hello, describe your self');
    return res;
  }
}
