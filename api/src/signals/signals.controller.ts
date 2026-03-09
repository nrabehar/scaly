import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { SignalsService } from './signals.service';
import { CreateSignalDto } from './dto/create-signal.dto';

@Controller('signals')
export class SignalsController {
    constructor(private signals: SignalsService) {}

    @Get('history')
    async history(@Query('symbol') symbol?: string) {
        return {
            success: true,
            signals: await this.signals.loadHistory(200, symbol),
        };
    }

    @Get('accuracy')
    async accuracy(@Query('symbol') symbol?: string) {
        const stats = await this.signals.computeAccuracy(symbol);
        return { success: true, ...stats };
    }

    @Post()
    async create(@Body() dto: CreateSignalDto) {
        const created = await this.signals.saveSignal(dto);
        return { success: true, signal: created };
    }

    @Patch(':id/resolve')
    async resolve(
        @Param('id', ParseIntPipe) id: number,
        @Body('outcome') outcome: string,
    ) {
        const updated = await this.signals.resolveSignal(id, outcome);
        return { success: true, signal: updated };
    }
}
