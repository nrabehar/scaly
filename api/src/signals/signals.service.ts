import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class SignalsService {
  constructor(private prisma: PrismaService) {}

  async saveSignal(signal: any) {
    return this.prisma.signal.create({ data: signal });
  }

  async loadHistory(limit = 200, symbol?: string) {
    const where = symbol ? { symbol } : undefined;
    return this.prisma.signal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async computeAccuracy(symbol?: string) {
    const records = await this.loadHistory(1000, symbol);
    let total = 0,
      wins = 0,
      losses = 0;
    for (const r of records) {
      const meta = r.metadata as any;
      if (meta && typeof meta === 'object' && 'outcome' in meta) {
        const outcome = meta.outcome as string;
        total++;
        if (outcome === 'win') wins++;
        else if (outcome === 'loss') losses++;
      }
    }
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, losses, winRate, pending: records.length - total };
  }
}
