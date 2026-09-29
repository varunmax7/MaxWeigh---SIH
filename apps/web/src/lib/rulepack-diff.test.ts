import { describe, expect, it } from 'vitest';
import { diffRulepackContent } from './rulepack-diff.js';

describe('diffRulepackContent', () => {
  it('finds no differences for identical content', () => {
    const content = { id: 'x', limits: { zeroSettingAccuracyE: '0.25' } };
    expect(diffRulepackContent(content, structuredClone(content))).toEqual([]);
  });

  it('reports a leaf-level scalar change with a dotted path', () => {
    const before = { limits: { zeroSettingAccuracyE: '0.25', creep30MinE: '0.5' } };
    const after = { limits: { zeroSettingAccuracyE: '0.30', creep30MinE: '0.5' } };
    expect(diffRulepackContent(before, after)).toEqual([
      { path: 'limits.zeroSettingAccuracyE', before: '0.25', after: '0.30' },
    ]);
  });

  it('reports an array field as a whole, not element by element', () => {
    const before = { mpeBands: { III: [{ upToE: 500, mpeE: '0.5' }] } };
    const after = { mpeBands: { III: [{ upToE: 500, mpeE: '0.1' }] } };
    const diff = diffRulepackContent(before, after);
    expect(diff).toEqual([
      {
        path: 'mpeBands.III',
        before: [{ upToE: 500, mpeE: '0.5' }],
        after: [{ upToE: 500, mpeE: '0.1' }],
      },
    ]);
  });

  it('reports a key present in only one side', () => {
    const before = { title: 'A' };
    const after = { title: 'A', verification: { verifiedBy: null } };
    expect(diffRulepackContent(before, after)).toEqual([
      { path: 'verification', before: undefined, after: { verifiedBy: null } },
    ]);
  });
});
