import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a',
  JWT_REFRESH_SECRET: 'r',
};

describe('validateEnv', () => {
  it('applies defaults for optional values', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3300');
    expect(env.NODE_ENV).toBe('development');
  });

  it('fails fast when a secret is missing', () => {
    const { JWT_REFRESH_SECRET: _omit, ...partial } = base;
    expect(() => validateEnv(partial)).toThrow(/JWT_REFRESH_SECRET/);
  });
});
