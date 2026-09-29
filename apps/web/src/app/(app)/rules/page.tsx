import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell/PageHeader';
import { listRulepacks } from '@/server/queries/rulepacks';
import { can } from '@/server/rbac';
import { requireSession } from '@/server/session';
import { RulepacksListClient } from './RulepacksListClient';

export const metadata: Metadata = { title: 'Rule packs' };

/**
 * Rule packs list (implementation.md §7.5, §10 P10). Not lab-scoped — see
 * `server/queries/rulepacks.ts`.
 */
export default async function RulepacksPage() {
  const session = await requireSession();
  const rows = await listRulepacks();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rule packs"
        description="The versioned OIML rule packs this app's engine runs against. Publishing a new version never changes an existing evaluation."
      />
      <RulepacksListClient rows={rows} canDraft={can(session.user.role, 'rulepack.draft')} />
    </div>
  );
}
