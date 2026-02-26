import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { SignalsService } from '../signals/signals.service';
import { AiSignalDto } from './dto/ai-signal.dto';

@Controller('api')
export class AiController {
  constructor(
    private ai: AiService,
    private signals: SignalsService,
  ) {}

  @Post('ai-signal')
  async aiSignal(@Body() body: AiSignalDto) {
    const { prompt, symbol, model } = body;
    const res = await this.ai.callAI(prompt, model || 'auto');
    if (res?.success && res.result?.signal) {
      const parsed = res.result.signal as any;
      const metadata: any = { raw: res.result.raw };
      // map common signal fields into metadata for easier querying
      if (parsed.entryPrice !== undefined)
        metadata.entryPrice = parsed.entryPrice;
      if (parsed.stopLoss !== undefined) metadata.stopLoss = parsed.stopLoss;
      if (parsed.takeProfit !== undefined)
        metadata.takeProfit = parsed.takeProfit;
      if (parsed.side !== undefined) metadata.side = parsed.side;
      if (parsed.confidence !== undefined)
        metadata.confidence = parsed.confidence;

      const sig = {
        symbol,
        provider: res.model || 'unknown',
        signal: JSON.stringify(parsed),
        score: typeof parsed.score === 'number' ? parsed.score : undefined,
        metadata,
      } as any;
      const saved = await this.signals.saveSignal(sig);
      return { success: true, model: res.model, parsed, saved };
    }
    return { success: false, reason: res?.reason || 'no_signal' };
  }
}
