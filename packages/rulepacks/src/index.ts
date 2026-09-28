/**
 * @tula/rulepacks — versioned OIML rule packs as data (implementation.md §4.11).
 *
 * The engine's `loadRulepack` only validates an in-memory value (it has no
 * I/O of its own — see packages/engine/src/rulepack.ts). This package used
 * to read the JSON files off disk with `node:fs` at module load, but P4's
 * live classification panel (implementation.md §7.5) needs the exact same
 * validated rule pack to run client-side in the browser, where `node:fs`
 * does not exist — Turbopack's client chunker fails outright on it
 * ("chunking context does not support external modules: node:fs"), not
 * just at runtime. Static JSON imports are bundler- and Node-ESM-safe in
 * both environments, so `data/` are imported as modules instead of read as
 * files; `resolveJsonModule` (tsconfig.base.json) covers the `tsc` build,
 * and the `with { type: 'json' }` attribute is required by Node's own ESM
 * loader when `dist/index.js` runs directly (unbundled, e.g. the worker).
 */
import { loadRulepack, loadWeightTable, type Rulepack, type WeightTable } from '@tula/engine';
import oimlR76RulepackJson from '../data/oiml-r76-1-2006/rulepack.json' with { type: 'json' };
import oimlR111WeightsJson from '../data/oiml-r111/weights.json' with { type: 'json' };

/** OIML R 76-1:2006, validated at module load. */
export const OIML_R76_1_2006: Rulepack = loadRulepack(oimlR76RulepackJson);

/** Rule-pack ids shipped with this build, newest edition last. */
export const AVAILABLE_RULEPACK_IDS = ['oiml-r76-1-2006'] as const;

export type RulepackId = (typeof AVAILABLE_RULEPACK_IDS)[number];

const RULEPACKS: Record<RulepackId, Rulepack> = {
  'oiml-r76-1-2006': OIML_R76_1_2006,
};

/** The rule pack for `id`, already validated. */
export function getRulepack(id: RulepackId): Rulepack {
  return RULEPACKS[id];
}

export type { R111Class, WeightTable as R111WeightTable } from '@tula/engine';

/** OIML R 111-1:2004 maximum-permissible-error seed table (implementation.md §4.8). */
export const OIML_R111_WEIGHTS: WeightTable = loadWeightTable(oimlR111WeightsJson);
