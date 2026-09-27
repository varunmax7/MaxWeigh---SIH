import { describe, expect, it } from 'vitest';
import { AVAILABLE_RULEPACK_IDS } from './index.js';

describe('@tula/rulepacks', () => {
  it('ships the R 76-1:2006 pack', () => {
    expect(AVAILABLE_RULEPACK_IDS).toContain('oiml-r76-1-2006');
  });
});
