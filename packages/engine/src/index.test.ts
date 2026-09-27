import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index.js';

describe('@tula/engine', () => {
  it('exposes an engine version to persist with every result', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
