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
  // Admin panel
  ADMIN_PIN: z
    .string()
    .regex(/^\d{6}$/, 'ADMIN_PIN must be exactly 6 digits')
    .default('412958'),
  ADMIN_JWT_SECRET: z
    .string()
    .min(32, 'ADMIN_JWT_SECRET must be at least 32 chars')
    .default('change-me-please-this-must-be-32-chars-or-longer-x'),
  ADMIN_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24),
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
      ADMIN_PIN: process.env.ADMIN_PIN ?? '412958',
      ADMIN_JWT_SECRET:
        process.env.ADMIN_JWT_SECRET ?? 'change-me-please-this-must-be-32-chars-or-longer-x',
      ADMIN_TOKEN_TTL_SECONDS: 60 * 60 * 24,
    };

export type AppConfig = typeof config;
