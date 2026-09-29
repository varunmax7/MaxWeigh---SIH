import { ROUTES } from '@/lib/routes';
import type { Permission } from '@/server/rbac';

/**
 * A lucide-react icon name, not the component itself — `NavItem` crosses
 * the server→client boundary (`AppShell` is a Server Component, everything
 * that renders it is a Client Component), and React can't serialize a
 * component reference across that boundary. `NAV_ICONS` in `icons.tsx`
 * resolves the name to a component, client-side only.
 */
export type NavIconName =
  | 'dashboard'
  | 'evaluations'
  | 'workspace'
  | 'instruments'
  | 'reports'
  | 'audit'
  | 'rules'
  | 'settings'
  | 'regulatory';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: NavIconName;
  /** Omitted = visible to every signed-in role. An array is "any of" — e.g. Rule packs needs either `rulepack.draft` (ADMIN/CHIEF_METROLOGY_OFFICER) or `rulepack.publish` (ADMIN/CONTROLLER, to confirm a publish). */
  permission?: Permission | Permission[];
}

/**
 * The sidebar's primary items, filtered by `can()` (implementation.md §7.4:
 * "a tester never sees Rule packs; an auditor never sees New evaluation").
 */
export const PRIMARY_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: ROUTES.dashboard, icon: 'dashboard' },
  {
    key: 'evaluations',
    label: 'Evaluations',
    href: ROUTES.evaluations,
    icon: 'evaluations',
    permission: 'evaluation.read',
  },
  {
    key: 'workspace',
    label: 'My tests',
    href: ROUTES.workspace,
    icon: 'workspace',
    permission: 'test.execute',
  },
  {
    key: 'instruments',
    label: 'Instruments',
    href: ROUTES.instruments,
    icon: 'instruments',
  },
  { key: 'reports', label: 'Reports', href: ROUTES.reports, icon: 'reports' },
  { key: 'audit', label: 'Audit log', href: ROUTES.audit, icon: 'audit', permission: 'audit.read' },
  {
    key: 'rules',
    label: 'Rule packs',
    href: ROUTES.rules,
    icon: 'rules',
    permission: ['rulepack.draft', 'rulepack.publish'],
  },
];

/** The sidebar's secondary (footer) items. */
export const SECONDARY_NAV: NavItem[] = [
  {
    key: 'settings',
    label: 'Settings',
    href: ROUTES.settings,
    icon: 'settings',
    permission: 'settings.manage',
  },
  { key: 'regulatory', label: 'Standards lib', href: ROUTES.regulatory, icon: 'regulatory' },
];
