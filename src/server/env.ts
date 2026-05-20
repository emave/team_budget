import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('data/team_budget.db'),
  BOT_TOKEN: z.string().min(10),
  BOT_USERNAME: z.string().min(1),
  BOOTSTRAP_ADMIN_TELEGRAM_ID: z.coerce.number().int().positive(),
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  STATS_TOKEN: z.string().min(16).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | null = null;

export function env(): Env {
  if (!_env) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
      );
    }
    _env = parsed.data;
  }
  return _env;
}

export function envForTest(overrides: Partial<Env> = {}): Env {
  return EnvSchema.parse({
    NODE_ENV: 'test',
    BOT_TOKEN: 'test:0123456789',
    BOT_USERNAME: 'test_bot',
    BOOTSTRAP_ADMIN_TELEGRAM_ID: '1',
    NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
    SESSION_SECRET: 'a'.repeat(32),
    ...overrides,
  });
}
