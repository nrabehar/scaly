import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
}

export default registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
  }),
);
