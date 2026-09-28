/**
 * Route constants for the app shell (implementation.md §3.3).
 *
 * Kept in one place so navigation, redirects and tests never drift from the
 * directory layout under `src/app`.
 */
export const ROUTES = {
  login: '/login',
  verifyTwoFactor: '/verify-2fa',
  enrollTwoFactor: '/enroll-2fa',
  dashboard: '/dashboard',
  evaluations: '/evaluations',
  workspace: '/workspace',
  instruments: '/instruments',
  reports: '/reports',
  audit: '/audit',
  rules: '/rules',
  settings: '/settings',
  regulatory: '/regulatory',
} as const;

export type RouteKey = keyof typeof ROUTES;

/** Where an unauthenticated visitor lands. */
export const ENTRY_ROUTE = ROUTES.login;
