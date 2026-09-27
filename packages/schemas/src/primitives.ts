/**
 * Shared primitives for observation schemas (implementation.md §2, §4.1).
 *
 * The same schema validates a payload in the browser form and again in the
 * server action, so the two can never drift.
 */
import { z } from 'zod';

/** A `Dec` (decimal string) boundary value — plain decimal notation only, no thousands separators. */
export const decSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'must be a plain decimal string, e.g. "5" or "0.1"');

export const errorMethodSchema = z.enum(['change_point', 'direct']);

export const mpeContextSchema = z.enum(['initial', 'in_service']);

/** A load-based observation row shared by several test codes (§4.5). */
export const weighingRowSchema = z.object({
  rowId: z.string().min(1),
  L: decSchema,
  I: decSchema,
  deltaL: decSchema.optional(),
  method: errorMethodSchema.optional(),
  rangeIndex: z.number().int().nonnegative().optional(),
});

export const zeroReferenceSchema = z.object({
  L: decSchema,
  I: decSchema,
  deltaL: decSchema.optional(),
  method: errorMethodSchema.optional(),
  rangeIndex: z.number().int().nonnegative().optional(),
});

export const checklistItemSchema = z.object({
  key: z.string().min(1),
  status: z.enum(['ok', 'fail', 'not_applicable']),
  note: z.string().optional(),
});
