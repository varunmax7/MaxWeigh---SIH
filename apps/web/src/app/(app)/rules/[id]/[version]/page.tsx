import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { getPublishedRulepack, getRulepackVersion } from '@/server/queries/rulepacks';
import { can } from '@/server/rbac';
import { requireSession } from '@/server/session';
import { RulepackDetailClient } from './RulepackDetailClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}): Promise<Metadata> {
  const { id, version } = await params;
  return { title: `${id}@${version}` };
}

/** Rule pack detail (implementation.md §7.5, §10 P10). */
export default async function RulepackDetailPage({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const session = await requireSession();
  const { id, version } = await params;

  const detail = await getRulepackVersion(id, version);
  if (!detail) notFound();

  const published = detail.status === 'PUBLISHED' ? detail : await getPublishedRulepack(id);

  return (
    <div className="space-y-6">
      <PageHeader title={`${detail.id}@${detail.version}`} description={detail.title} />
      <RulepackDetailClient
        detail={detail}
        publishedContent={
          published && published.version !== detail.version ? published.content : null
        }
        canDraft={can(session.user.role, 'rulepack.draft')}
        role={session.user.role}
      />
    </div>
  );
}
