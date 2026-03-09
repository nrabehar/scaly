import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

export interface SaveSignalInput {
    symbol: string;
    signal: string;
    provider?: string;
    score?: number;
    metadata?: Record<string, unknown>;
}

@Injectable()
export class SignalsService {
    constructor(private prisma: PrismaService) {}

    async saveSignal(input: SaveSignalInput) {
        return this.prisma.signal.create({
            data: {
                symbol: input.symbol,
                signal: input.signal,
                provider: input.provider,
                score: input.score,
                metadata: input.metadata as any,
            },
        });
    }

    async loadHistory(limit = 200, symbol?: string) {
        const where = symbol ? { symbol } : undefined;
        return this.prisma.signal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async resolveSignal(id: number, outcome: string) {
        return this.prisma.signal.update({
            where: { id },
            data: {
                resolved: true,
                outcome: outcome.toUpperCase(),
                resolvedAt: new Date(),
            },
        });
    }

    async loadPendingSignals(maxAgeHours = 24) {
        const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
        return this.prisma.signal.findMany({
            where: {
                resolved: false,
                signal: { in: ['BUY', 'SELL'] },
                createdAt: { gte: since },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async computeAccuracy(symbol?: string) {
        const where = symbol ? { symbol } : {};
        const total = await this.prisma.signal.count({
            where: { ...where, outcome: { not: null } },
        });
        const wins = await this.prisma.signal.count({
            where: { ...where, outcome: 'WIN' },
        });
        const losses = await this.prisma.signal.count({
            where: { ...where, outcome: 'LOSS' },
        });
        const pending = await this.prisma.signal.count({
            where: { ...where, resolved: false },
        });
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        return { total, wins, losses, winRate, pending };
    }
}
