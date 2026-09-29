import type { ReactNode } from 'react';

/**
 * The print route's own layout (implementation.md §8.2) — no `AppShell`,
 * no session check via `(app)/layout.tsx`: this route is reached by the
 * worker (no session at all) and by the officer's own live-preview
 * `<iframe>`, and is authorized by the short-lived print token the page
 * itself verifies, not by a signed-in session.
 */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
