import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  REQUIRE_EMAIL_VERIFICATION: bool.default(true),
  MAIL_MODE: z.enum(['console', 'smtp']).default('console'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Minhas Despesas <no-reply@localhost>'),
  WEB_URL: z.string().default('http://localhost:3000'),
  COINGECKO_API_KEY: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().default(1),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida (.env): ${msg}`);
  }
  if (parsed.data.MAIL_MODE === 'smtp' && !parsed.data.SMTP_URL) {
    throw new Error('Configuração inválida (.env): MAIL_MODE=smtp exige SMTP_URL');
  }
  cached = parsed.data;
  return cached;
}
export function resetEnvCache() { cached = null; }
