import type { ReactNode } from 'react';
import { getActiveLabId } from '@/server/active-lab';
import { getLabMemberships } from '@/server/queries/lab-memberships';
import { getLedgerStatus } from '@/server/queries/ledger-status';
import { can, type Permission } from '@/server/rbac';
import type { AppSession } from '@/server/session';
import { AppShellClient } from './AppShellClient';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav-config';

/**
 * The app frame (implementation.md §7.4), composed server-side so nav
 * filtering, the ledger head hash and lab memberships are real data, not
 * stubs re-fetched by a client component.
 */
export async function AppShell({
  session,
  children,
}: {
  session: AppSession;
  children: ReactNode;
}) {
  const [labs, ledger] = await Promise.all([getLabMemberships(session.user.id), getLedgerStatus()]);
  const activeLabId = (await getActiveLabId()) ?? labs[0]?.id ?? '';

  const hasNavPermission = (item: { permission?: Permission | Permission[] }) => {
    if (!item.permission) return true;
    const required = Array.isArray(item.permission) ? item.permission : [item.permission];
    return required.some((p) => can(session.user.role, p));
  };
  const primaryItems = PRIMARY_NAV.filter(hasNavPermission);
  const secondaryItems = SECONDARY_NAV.filter(hasNavPermission);

  return (
    <AppShellClient
      primaryItems={primaryItems}
      secondaryItems={secondaryItems}
      labs={labs}
      activeLabId={activeLabId}
      canCreateEvaluation={can(session.user.role, 'evaluation.create')}
      user={{ name: session.user.name, email: session.user.email, role: session.user.role }}
      ledgerVerified={ledger.headHash !== null}
      ledgerHeadShort={ledger.headHash ? ledger.headHash.slice(0, 4).toUpperCase() : '— none —'}
    >
      {children}
    </AppShellClient>
  );
}
