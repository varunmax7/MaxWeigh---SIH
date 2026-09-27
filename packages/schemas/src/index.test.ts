import { describe, expect, it } from 'vitest';
import { OBSERVATION_SCHEMA_VERSION } from './index.js';

describe('@tula/schemas', () => {
  it('starts observation payloads at schema version 1', () => {
    expect(OBSERVATION_SCHEMA_VERSION).toBe(1);
  });
});
