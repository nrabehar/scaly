import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { PricesModule } from '../prices/prices.module';
import { SignalsModule } from '../signals/signals.module';
import { PrismaModule } from '../persistence/prisma.module';
import { SimulationService } from '../prices/simulation.service';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [PricesModule, SignalsModule, PrismaModule, AiModule],
    controllers: [ApiController],
    providers: [SimulationService],
})
export class ApiModule {}
