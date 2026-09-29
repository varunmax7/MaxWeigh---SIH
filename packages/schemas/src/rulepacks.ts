/**
 * Rule-pack admin action schemas (implementation.md §10 P10, §4.11). The
 * draft `content` itself is validated by `@tula/engine`'s `loadRulepack` —
 * a Zod schema in this package can't reuse that private schema, and
 * shouldn't duplicate it (the engine owns rule-pack shape); this layer
 * only validates the envelope around it.
 */
import { z } from 'zod';

export const rulepackRefSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
});

export const cloneRulepackDraftInputSchema = z.object({
  sourceId: z.string().min(1),
  sourceVersion: z.string().min(1),
});

export const updateRulepackDraftInputSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  /** The full rule-pack JSON object — validated against `loadRulepack` inside the action, not here. */
  content: z.record(z.string(), z.unknown()),
});

export const compareRulepackDraftInputSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  /** An evaluation's reference number (e.g. `EV-RRSL-BLR-2026-0142`) — the officer-facing identifier, not its internal id. */
  refNo: z.string().min(1),
});
