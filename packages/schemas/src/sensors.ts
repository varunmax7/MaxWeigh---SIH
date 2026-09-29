/**
 * Environment sensor ingest schema (implementation.md §5 `env_readings`,
 * §10 P10). Mirrors `execution.ts`'s `envConditionsSchema` numeric ranges —
 * temperature/humidity/pressure are physical readings, not masses, so §4.1's
 * Decimal-string policy doesn't apply to them (see that file's own comment).
 */
import { z } from 'zod';

export const envReadingIngestSchema = z.object({
  tempC: z.number().min(-40).max(80),
  rhPct: z.number().min(0).max(100),
  pressureHpa: z.number().min(800).max(1100),
  /** Device-supplied reading time; defaults to server receipt time when omitted. */
  ts: z.iso.datetime().optional(),
});
