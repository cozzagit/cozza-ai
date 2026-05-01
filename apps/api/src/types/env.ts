/**
 * Hono environment variables for cozza-ai API (Node runtime).
 * The actual config is loaded from process.env at boot — see ./config.ts.
 * This file mirrors the shape exposed via `c.var.config`.
 */
import type { AppConfig } from '@/config';

export interface AppVariables {
  config: AppConfig;
  validatedBody?: unknown;
}

export type AppEnv = {
  Variables: AppVariables;
};
