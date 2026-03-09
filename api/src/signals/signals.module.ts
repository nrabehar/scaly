import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { ScalpService } from './scalp.service';
import { PrismaModule } from '../persistence/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SignalsController],
    providers: [SignalsService, ScalpService],
    exports: [SignalsService, ScalpService],
})
export class SignalsModule {}
