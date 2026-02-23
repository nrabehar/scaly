import { registerAs } from '@nestjs/config';

export interface AgentConfig {
  groqApiKey?: string;
}

export default registerAs(
  'agent',
  (): AgentConfig => ({
    groqApiKey: process.env.GROQ_API_KEY,
  }),
);
