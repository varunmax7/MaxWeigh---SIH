/**
 * @tula/rulepacks — versioned OIML rule packs as data (implementation.md §4.11).
 *
 * The engine's `loadRulepack` only validates an in-memory value (it has no
 * I/O of its own — see packages/engine/src/rulepack.ts); reading the JSON
 * files off disk is this package's job. `data/` sits beside `src/` and
 * `dist/`, so the same relative path resolves whether this runs from source
 * (`tsx`) or from the compiled `dist/index.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRulepack, loadWeightTable, type Rulepack, type WeightTable } from '@tula/engine';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(packageRoot, 'data', relativePath), 'utf-8'));
}

/** OIML R 76-1:2006, validated at module load. */
export const OIML_R76_1_2006: Rulepack = loadRulepack(readJson('oiml-r76-1-2006/rulepack.json'));

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
export const OIML_R111_WEIGHTS: WeightTable = loadWeightTable(readJson('oiml-r111/weights.json'));
