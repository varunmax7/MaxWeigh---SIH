import { z } from 'zod';

/**
 * Environment contract for every Tula process (implementation.md §10, P0).
 *
 * Validation happens once, at startup, and fails loudly: a government lab
 * should never discover a missing signing key halfway through issuing a
 * certificate.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Postgres connection string, e.g. postgres://tula:tula@localhost:5432/tula */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /** Public origin of the web app; QR codes and share links are built from it. */
  APP_URL: z.url(),

  /** Better Auth session secret. */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('tula'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),

  /** SMTP transport URL, e.g. smtp://localhost:1025 (Mailpit in dev). */
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),

  /** Signs the short-lived token the worker uses to reach the print route. */
  PRINT_TOKEN_SECRET: z.string().min(32, 'PRINT_TOKEN_SECRET must be at least 32 characters'),

  /** PKCS#12 bundle used for PAdES signing; a dev certificate until a DSC token is wired up. */
  SIGNING_P12_PATH: z.string().min(1).optional(),
  SIGNING_P12_PASSWORD: z.string().optional(),

  /** Password given to every seeded demo account. */
  SEED_PASSWORD: z.string().min(8).default('tula-dev-password'),
});

export type Env = z.infer<typeof envSchema>;

/** Thrown when the process environment does not satisfy {@link envSchema}. */
export class EnvValidationError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    const lines = issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    super(`Invalid environment:\n${lines.join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parse and validate an environment record.
 *
 * @param source raw environment, defaulting to `process.env`
 * @throws {EnvValidationError} when a required variable is missing or malformed
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated environment for the current process, parsed once and memoised. */
export function env(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test helper: drop the memoised environment so the next {@link env} call re-parses. */
export function resetEnvCache(): void {
  cached = undefined;
}
