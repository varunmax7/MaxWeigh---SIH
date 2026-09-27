import { describe, expect, it } from 'vitest';
import { DEFAULT_RULEPACK_ID, ENGINE_VERSION } from './index.js';

describe('@tula/engine', () => {
  it('exposes an engine version to persist with every result', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('names the OIML R 76-1:2006 rule pack as the default', () => {
    expect(DEFAULT_RULEPACK_ID).toBe('oiml-r76-1-2006');
  });
});
