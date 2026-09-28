import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell/PageHeader';
import { getActiveLabId } from '@/server/active-lab';
import { getLabMemberships } from '@/server/queries/lab-memberships';
import { getAttachment, getLab } from '@/server/queries/masterdata';
import { requireSession } from '@/server/session';
import { presignGetUrl } from '@/server/storage';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'Settings' };

/**
 * Lab settings (implementation.md §7.5 "Settings": lab profile, logo,
 * numbering patterns, signatory titles, SLA hours — §10 P4). Users & roles
 * and device keys are out of scope here: device keys are issued from the
 * Instruments → Reference equipment tab, and users & roles has no phase
 * task yet.
 */
export default async function SettingsPage() {
  const session = await requireSession();
  const memberships = await getLabMemberships(session.user.id);
  const activeLabId = (await getActiveLabId()) ?? memberships[0]?.id ?? null;
  const lab = activeLabId ? await getLab(activeLabId) : null;

  let logoPreviewUrl: string | null = null;
  if (lab?.logoKey) {
    const attachment = await getAttachment(lab.logoKey);
    if (attachment) logoPreviewUrl = await presignGetUrl(attachment.storageKey);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={lab ? `Lab profile for ${lab.name}.` : 'Select a lab to manage its settings.'}
      />
      {lab ? (
        <SettingsForm lab={lab} logoPreviewUrl={logoPreviewUrl} />
      ) : (
        <p className="text-sm text-muted-foreground">
          You are not a member of any lab yet — settings has nothing to show.
        </p>
      )}
    </div>
  );
}
