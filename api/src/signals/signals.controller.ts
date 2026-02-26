import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { CreateSignalDto } from './dto/create-signal.dto';

@Controller('api')
export class SignalsController {
  constructor(private signals: SignalsService) {}

  @Get('signal-history')
  async history(@Query('symbol') symbol?: string) {
    return {
      success: true,
      signals: await this.signals.loadHistory(200, symbol),
    };
  }

  @Get('signal-accuracy')
  async accuracy(@Query('symbol') symbol?: string) {
    const stats = await this.signals.computeAccuracy(symbol);
    return { success: true, ...stats };
  }

  @Post('signal')
  async create(@Body() dto: CreateSignalDto) {
    const created = await this.signals.saveSignal(dto as any);
    return { success: true, signal: created };
  }
}
