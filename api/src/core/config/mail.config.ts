import { registerAs } from '@nestjs/config';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export default registerAs('mail', async (): Promise<MailConfig> => {
  return {
    host: process.env.SMTP_HOST || 'mailhog',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: false,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@scaly.com',
  };
});
