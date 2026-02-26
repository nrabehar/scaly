import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  async append(entry: {
    event: string;
    path?: string;
    ip?: string;
    userAgent?: string;
    fingerprint?: string;
    details?: any;
  }) {
    return this.prisma.accessLog.create({ data: entry as any });
  }

  async list(limit = 200) {
    return this.prisma.accessLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
