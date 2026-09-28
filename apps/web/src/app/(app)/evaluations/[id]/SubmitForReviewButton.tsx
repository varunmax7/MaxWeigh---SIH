'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { submitForReviewAction } from '@/server/actions/review';

/** `IN_TESTING | RETURNED | AMENDING → PENDING_T1` (implementation.md §6.3, §7.5). */
export function SubmitForReviewButton({ evaluationId }: { evaluationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await submitForReviewAction({ evaluationId });
    setPending(false);
    if (!result.ok) {
      toast.error(
        result.code === 'RULE'
          ? 'Every applicable test must be marked complete before this can be submitted.'
          : 'Could not submit this evaluation for review.',
      );
      return;
    }
    toast.success(`Submitted for review as version ${result.data.version}`);
    router.push(`/evaluations/${evaluationId}/review`);
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={pending}>
      {pending ? 'Submitting…' : 'Submit for review'}
    </Button>
  );
}
