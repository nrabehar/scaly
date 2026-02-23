import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  jwtResetSecret: string;
  cookieSecret: string;
  cookieMaxAge: number;
}

export default registerAs('auth', async (): Promise<AuthConfig> => {
  return {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    jwtExpiresIn: '15m',
    jwtRefreshSecret:
      process.env.JWT_REFRESH_SECRET || 'change-me-refresh-in-production',
    jwtRefreshExpiresIn: '7d',
    jwtResetSecret:
      process.env.JWT_RESET_SECRET || 'change-me-reset-in-production',
    cookieSecret: process.env.COOKIE_SECRET || 'change-me-cookie-secret',
    cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || '604800000', 10), // 7 days
  };
});
