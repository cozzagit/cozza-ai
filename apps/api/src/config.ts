import 'dotenv/config';
import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3025),
  HOST: z.string().default('127.0.0.1'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  ELEVENLABS_API_KEY: z.string().min(1, 'ELEVENLABS_API_KEY is required'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
  COMMIT_SHA: z.string().default('local'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(JSON.stringify({ event: 'config.invalid', issues: parsed.error.issues }));
  // Allow boot without keys in test env, fail-fast in prod
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export const config = parsed.success
  ? parsed.data
  : {
      PORT: 3025,
      HOST: '127.0.0.1',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? '',
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173',
      RATE_LIMIT_PER_MIN: 30,
      COMMIT_SHA: process.env.COMMIT_SHA ?? 'local',
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') ?? 'development',
    };

export type AppConfig = typeof config;
