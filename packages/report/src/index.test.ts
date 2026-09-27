import { describe, expect, it } from 'vitest';
import { REPORT_MODEL_VERSION } from './index.js';

describe('@tula/report', () => {
  it('starts the report model at version 1', () => {
    expect(REPORT_MODEL_VERSION).toBe(1);
  });
});
