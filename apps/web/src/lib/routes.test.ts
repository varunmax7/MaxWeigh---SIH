import { describe, expect, it } from 'vitest';
import { ENTRY_ROUTE, ROUTES } from './routes.js';

describe('routes', () => {
  it('sends unauthenticated visitors to the login page', () => {
    expect(ENTRY_ROUTE).toBe('/login');
  });

  it('declares absolute paths only', () => {
    for (const path of Object.values(ROUTES)) {
      expect(path.startsWith('/')).toBe(true);
    }
  });
});
