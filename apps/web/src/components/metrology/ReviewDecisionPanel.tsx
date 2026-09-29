'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { DecisionDialog } from '@/components/forms/DecisionDialog';
import { Button } from '@/components/ui/button';
import {
  decideTier1Action,
  decideTier2Action,
  decideTier3Action,
} from '@/server/actions/tier-decision';

const DECIDE = {
  1: decideTier1Action,
  2: decideTier2Action,
  3: decideTier3Action,
} as const;

/**
 * The review screen's decision block (implementation.md §7.5): one primary
 * button per tier's own verb, plus "Return with comments". Only rendered for
 * the tier currently pending and the role that may decide it — the server
 * action re-checks both, this is just what keeps the UI honest about what
 * will happen when clicked.
 */
export function ReviewDecisionPanel({
  evaluationId,
  tier,
  modelSha256,
  approveVerb,
}: {
  evaluationId: string;
  tier: 1 | 2 | 3;
  modelSha256: string;
  approveVerb: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'approve' | 'return' | null>(null);
  const [pending, setPending] = useState(false);

  async function handleConfirm({ comment, totpCode }: { comment?: string; totpCode: string }) {
    if (!dialog) return;
    setPending(true);
    const decide = DECIDE[tier];
    const result = await decide({
      evaluationId,
      modelSha256,
      decision: dialog === 'approve' ? 'APPROVE' : 'RETURN',
      totpCode,
      comment,
    });
    setPending(false);
    setDialog(null);

    if (!result.ok) {
      const message =
        result.code === 'CONFLICT'
          ? 'This evaluation moved on. Reload to see its current state.'
          : result.code === 'FORBIDDEN'
            ? 'That code was not accepted.'
            : 'Could not record the decision.';
      toast.error(message);
      return;
    }

    toast.success(
      dialog === 'approve' ? `${approveVerb} recorded` : 'Report returned with comments',
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setDialog('approve')}>{approveVerb}</Button>
      <Button variant="outline" onClick={() => setDialog('return')}>
        Return with comments
      </Button>

      <DecisionDialog
        open={dialog !== null}
        mode={dialog ?? 'approve'}
        approveVerb={approveVerb}
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
