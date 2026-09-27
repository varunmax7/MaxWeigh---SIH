/**
 * @tula/rulepacks — versioned OIML rule packs as data.
 *
 * Each pack is a JSON file holding one edition's constants and test catalog
 * (implementation.md §4.11). Code never hard-codes an OIML constant; it reads
 * it from the pack pinned to the evaluation.
 *
 * P1 adds `oiml-r76-1-2006/rulepack.json` and `oiml-r111/weights.json`.
 */

import { DEFAULT_RULEPACK_ID } from '@tula/engine';

/** Rule-pack ids shipped with this build, newest edition last. */
export const AVAILABLE_RULEPACK_IDS = [DEFAULT_RULEPACK_ID] as const;

export type RulepackId = (typeof AVAILABLE_RULEPACK_IDS)[number];
