import { registerAs } from '@nestjs/config';

export interface NewsConfig {
    cryptopanicApiKey: string;
    finnhubApiKey?: string;
}

export default registerAs(
    'news',
    (): NewsConfig => ({
        cryptopanicApiKey: process.env.CRYPTOPANIC_API_KEY || '',
        finnhubApiKey: process.env.FINNHUB_API_KEY,
    }),
);
