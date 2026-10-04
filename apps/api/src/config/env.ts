// Validates process.env once at boot so a missing secret fails fast
// instead of surfacing as a confusing runtime error later.
export interface Env {
  PORT: number;
  DATABASE_URL: string;
  /** Optional: without it, background jobs run in-process (see JobsModule). */
  REDIS_URL?: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  WEB_ORIGIN: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export function validateEnv(raw: Record<string, unknown>): Env {
  const missing = required.filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  return {
    PORT: Number(raw.PORT ?? 4000),
    DATABASE_URL: String(raw.DATABASE_URL),
    REDIS_URL: raw.REDIS_URL ? String(raw.REDIS_URL) : undefined,
    JWT_ACCESS_SECRET: String(raw.JWT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: String(raw.JWT_REFRESH_SECRET),
    WEB_ORIGIN: String(raw.WEB_ORIGIN ?? 'http://localhost:3300'),
    NODE_ENV: (raw.NODE_ENV as Env['NODE_ENV']) ?? 'development',
  };
}
