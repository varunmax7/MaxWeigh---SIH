'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmEnrollmentAction, startEnrollmentAction } from './actions';
import { CONFIRM_ENROLLMENT_INITIAL_STATE, START_ENROLLMENT_INITIAL_STATE } from './state';

/**
 * Two steps in one page (implementation.md §9, §10 P2): re-enter the
 * password to generate a TOTP secret, then confirm it with the first code
 * the authenticator app produces.
 */
export function EnrollForm() {
  const [startState, startAction, starting] = useActionState(
    startEnrollmentAction,
    START_ENROLLMENT_INITIAL_STATE,
  );
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmEnrollmentAction,
    CONFIRM_ENROLLMENT_INITIAL_STATE,
  );

  if (startState.status !== 'started') {
    return (
      <form action={startAction} className="mt-6 space-y-4" noValidate>
        {startState.status === 'error' ? (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
          >
            {startState.message}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" disabled={starting} className="w-full">
          {starting ? 'Generating…' : 'Generate QR code'}
        </Button>
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Scan this with your authenticator app, then enter the code it shows.
      </p>

      {startState.qrDataUrl ? (
        <Image
          src={startState.qrDataUrl}
          alt="Scan with your authenticator app to enrol Tula"
          width={200}
          height={200}
          unoptimized
          className="mx-auto"
        />
      ) : null}

      {startState.backupCodes ? (
        <div className="rounded-[var(--radius-control)] bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Backup codes — save these now, they are shown only once:
          </p>
          <ul className="tabular mt-2 grid grid-cols-2 gap-1 text-sm">
            {startState.backupCodes.map((backupCode) => (
              <li key={backupCode}>{backupCode}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={confirmAction} className="space-y-4" noValidate>
        {confirmState.status === 'error' ? (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
          >
            {confirmState.message}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="code">Authentication code</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={6}
            required
            className="tabular"
          />
        </div>

        <Button type="submit" disabled={confirming} className="w-full">
          {confirming ? 'Verifying…' : 'Confirm and continue'}
        </Button>
      </form>
    </div>
  );
}
