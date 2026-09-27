import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.js';

const valid: Record<string, string> = {
  DATABASE_URL: 'postgres://tula:tula@localhost:5432/tula',
  APP_URL: 'http://localhost:3000',
  AUTH_SECRET: 'a'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'tula',
  S3_SECRET_KEY: 'tula-secret',
  SMTP_URL: 'smtp://localhost:1025',
  PRINT_TOKEN_SECRET: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('accepts a complete development environment and applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.NODE_ENV).toBe('development');
    expect(env.S3_BUCKET).toBe('tula');
    expect(env.S3_REGION).toBe('us-east-1');
  });

  it('rejects a short AUTH_SECRET', () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: 'too-short' })).toThrow(EnvValidationError);
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://localhost/tula' })).toThrow(
      EnvValidationError,
    );
  });

  it('names every missing variable in one error', () => {
    try {
      parseEnv({});
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as EnvValidationError).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('AUTH_SECRET');
      expect(message).toContain('S3_ENDPOINT');
    }
  });
});
