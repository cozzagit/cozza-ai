import type { Context, MiddlewareHandler } from 'hono';
import type { ZodSchema, ZodError } from 'zod';
import type { AppEnv } from '@/types/env';

const MAX_BODY_BYTES = 1_000_000; // 1 MB

export function validateBody<T>(schema: ZodSchema<T>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const lenHeader = c.req.header('Content-Length');
    if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
      return c.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Body too large' } }, 413);
    }
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, 400);
    }
    const result = schema.safeParse(json);
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: zodIssues(result.error),
          },
        },
        400,
      );
    }
    c.set('validatedBody', result.data);
    await next();
    return;
  };
}

export function getValidated<T>(c: Context<AppEnv>): T {
  return c.get('validatedBody') as T;
}

function zodIssues(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}
