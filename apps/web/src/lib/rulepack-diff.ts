/**
 * A readable diff between two rule-pack content objects (implementation.md
 * §10 P10: "diff vs published"). Recurses through plain objects only —
 * arrays (a class's list of MPE bands, the test catalogue, …) are compared
 * whole, not element-by-element, since a partial-array diff reads as noise
 * for content this shape (better to see "classification.III changed" and
 * open the readable table than a line-by-line array patch).
 */
export interface RulepackDiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diffAt(path: string, before: unknown, after: unknown, out: RulepackDiffEntry[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      diffAt(path ? `${path}.${key}` : key, before[key], after[key], out);
    }
    return;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    out.push({ path, before, after });
  }
}

export function diffRulepackContent(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): RulepackDiffEntry[] {
  const out: RulepackDiffEntry[] = [];
  diffAt('', before, after, out);
  return out;
}
