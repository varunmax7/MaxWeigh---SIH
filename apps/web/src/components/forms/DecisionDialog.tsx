'use client';

import { useId, useState } from 'react';
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

/**
 * The review screen's decision block (implementation.md §7.5: "one decision
 * block: Verify / Approve / Seal and issue, plus Return with comments...
 * Decision requires TOTP"). One dialog for both outcomes rather than two,
 * since they share the same step-up field and differ only in whether the
 * comment is required.
 */
export function DecisionDialog({
  open,
  mode,
  approveVerb,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  mode: 'approve' | 'return';
  /** e.g. "Verify", "Approve", "Seal and issue" — §7.8: the button, the dialog and the toast share one verb. */
  approveVerb: string;
  onConfirm: (input: { comment?: string; totpCode: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [comment, setComment] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const commentId = useId();
  const totpId = useId();

  const commentRequired = mode === 'return';
  const totpValid = /^\d{6}$/.test(totpCode.trim());
  const canConfirm = totpValid && (!commentRequired || comment.trim().length > 0);

  function handleOpenChange(next: boolean) {
    if (!next && !pending) {
      setComment('');
      setTotpCode('');
      onCancel();
    }
  }

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm({ comment: comment.trim() || undefined, totpCode: totpCode.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'approve' ? approveVerb : 'Return with comments'}</DialogTitle>
          <DialogDescription>
            {mode === 'approve'
              ? 'This decision is recorded against the report version you are looking at, with your name, role and a fresh authentication code.'
              : 'The report goes back to the tester. Only the tests you comment on will unlock for changes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={commentId}>
              {commentRequired ? 'What needs to change' : 'Comment (optional)'}
            </Label>
            <Textarea
              id={commentId}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
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
            <p className="text-xs text-muted-foreground">
              Enter the current 6-digit code from your authenticator app.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || pending}>
            {pending
              ? 'Recording decision…'
              : mode === 'approve'
                ? approveVerb
                : 'Return with comments'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
