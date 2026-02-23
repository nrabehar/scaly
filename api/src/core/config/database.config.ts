import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
}

export default registerAs(
  'database',
  (): DatabaseConfig => ({
    url: process.env.DATABASE_URL || '',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),
    minConnections: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '1', 10),
    connectionTimeout: parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT || '10000',
      10
    ),
  })
);
