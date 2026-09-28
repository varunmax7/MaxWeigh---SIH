'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/components/forms/ReasonDialog';
import { Button } from '@/components/ui/button';
import { cancelEvaluationAction } from '@/server/actions/evaluations';

/** DRAFT/PLANNED → CANCELLED (implementation.md §6.3), with a reason on record. */
export function CancelEvaluationButton({ evaluationId }: { evaluationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm(reason: string) {
    setPending(true);
    const result = await cancelEvaluationAction({ id: evaluationId, reason });
    setPending(false);
    setOpen(false);
    if (!result.ok) {
      toast.error('Could not cancel this evaluation.');
      return;
    }
    toast.success('Evaluation cancelled');
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={pending}>
        Cancel evaluation
      </Button>
      <ReasonDialog
        open={open}
        title="Cancel this evaluation"
        description="This evaluation moves to Cancelled and can no longer be planned or tested."
        confirmLabel="Cancel evaluation"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
