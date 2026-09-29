'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { revokeReportAction } from '@/server/actions/report';

/**
 * §8.5 "revoke flow (Controller, TOTP, reason)" — the one destructive,
 * irreversible action on this screen (implementation.md §7.7: destructive
 * actions require a typed reason), so it gets its own confirmation dialog
 * rather than reusing `DecisionDialog` (whose copy is written for
 * verify/approve/return, not withdrawal).
 */
export function RevokeReportButton({ evaluationId }: { evaluationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [pending, setPending] = useState(false);
  const reasonId = useId();
  const totpId = useId();

  const canConfirm = reason.trim().length > 0 && /^\d{6}$/.test(totpCode.trim());

  function reset() {
    setReason('');
    setTotpCode('');
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setPending(true);
    const result = await revokeReportAction({
      evaluationId,
      reason: reason.trim(),
      totpCode: totpCode.trim(),
    });
    setPending(false);
    setOpen(false);
    reset();

    if (!result.ok) {
      toast.error(
        result.code === 'FORBIDDEN'
          ? 'That code was not accepted.'
          : 'Could not revoke this report.',
      );
      return;
    }
    toast.success('Report revoked');
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-fail">
        Revoke
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !pending) {
            setOpen(false);
            reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this report</DialogTitle>
            <DialogDescription>
              The certificate and report are marked REVOKED everywhere they can be verified. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={reasonId}>Reason</Label>
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={totpId}>Authenticator code</Label>
              <Input
                id={totpId}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="tabular w-32"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm || pending}>
              {pending ? 'Revoking…' : 'Revoke report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
