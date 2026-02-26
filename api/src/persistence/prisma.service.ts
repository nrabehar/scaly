import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const adapter = new PrismaBetterSqlite3({
      url: configService.get<string>('database.url') || 'file:./dev.db',
    });

    super({
      adapter,
      log: ['error', 'warn'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');

      // Query logging in development is handled via Prisma log config
      if (this.configService.get('app.nodeEnv') === 'development') {
        this.logger.log('Development mode: Query logging enabled');
      }
    } catch (error) {
      this.logger.error(
        `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from database');
    } catch (error) {
      this.logger.error(
        `Error disconnecting from database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
