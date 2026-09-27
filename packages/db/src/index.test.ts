import { describe, expect, it } from 'vitest';
import { REQUIRED_EXTENSIONS } from './index.js';

describe('@tula/db', () => {
  it('requires trigram search and pgcrypto', () => {
    expect([...REQUIRED_EXTENSIONS]).toEqual(['pg_trgm', 'pgcrypto']);
  });
});
