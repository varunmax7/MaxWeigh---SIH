'use client';

import { Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createShareLinkAction, revokeShareLinkAction } from '@/server/actions/report';

export interface ShareLinkRow {
  id: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdByName: string;
}

/**
 * Secure share links (implementation.md §8.5): expiring, read-only, single
 * report version. The raw token is shown to the officer exactly once, right
 * after creation — the server only ever stores its hash — so this panel
 * keeps it in local state, never refetches it, and warns before it
 * disappears.
 */
export function ShareLinkPanel({
  evaluationId,
  links,
}: {
  evaluationId: string;
  links: ShareLinkRow[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ url: string; expiresAt: string } | null>(null);

  async function handleCreate() {
    setCreating(true);
    const result = await createShareLinkAction({ evaluationId, expiresInDays: 7 });
    setCreating(false);
    if (!result.ok) {
      toast.error('Could not create a share link.');
      return;
    }
    const url = `${window.location.origin}/shared/reports/${result.data.token}`;
    setJustCreated({ url, expiresAt: result.data.expiresAt });
    router.refresh();
  }

  async function handleRevoke(shareLinkId: string) {
    const result = await revokeShareLinkAction({ shareLinkId });
    if (!result.ok) {
      toast.error('Could not revoke this share link.');
      return;
    }
    toast.success('Share link revoked');
    router.refresh();
  }

  async function copyLink() {
    if (!justCreated) return;
    await navigator.clipboard.writeText(justCreated.url);
    toast.success('Link copied');
  }

  const active = links.filter((l) => !l.revokedAt && l.expiresAt.getTime() > Date.now());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Secure share links</p>
        <Button size="sm" variant="outline" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create link'}
        </Button>
      </div>

      {justCreated ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-active/30 bg-active-bg p-2 text-xs">
          <span className="mono flex-1 truncate">{justCreated.url}</span>
          <Button size="icon-xs" variant="ghost" onClick={copyLink} aria-label="Copy link">
            <Copy className="size-3.5" />
          </Button>
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active share links.</p>
      ) : (
        <ul className="space-y-1">
          {active.map((link) => (
            <li key={link.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                By {link.createdByName} · expires {link.expiresAt.toISOString().slice(0, 10)}
              </span>
              <Button size="xs" variant="ghost" onClick={() => handleRevoke(link.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
