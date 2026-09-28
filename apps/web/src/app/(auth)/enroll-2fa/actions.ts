'use server';

import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { ROUTES } from '@/lib/routes';
import { auth } from '@/server/auth';

export interface StartEnrollmentState {
  status: 'idle' | 'error' | 'started';
  message?: string;
  qrDataUrl?: string;
  backupCodes?: string[];
}

export const START_ENROLLMENT_INITIAL_STATE: StartEnrollmentState = { status: 'idle' };

/** Enables TOTP for the signed-in user and returns its QR code + one-time backup codes. */
export async function startEnrollmentAction(
  _previous: StartEnrollmentState,
  formData: FormData,
): Promise<StartEnrollmentState> {
  const password = String(formData.get('password') ?? '');
  if (!password) return { status: 'error', message: 'Enter your password.' };

  try {
    const response = await auth.api.enableTwoFactor({
      body: { password, method: 'totp' },
      headers: await nextHeaders(),
    });
    // Better Auth's `StrictEndpoint` overloads resolve ambiguously for a call
    // site with neither `asResponse` nor `returnHeaders`/`returnStatus`; this
    // reasserts the documented JSON-body shape.
    const result = response as unknown as
      | { method: 'totp'; totpURI: string; backupCodes: string[] }
      | { method: 'otp' };
    if (result.method !== 'totp') {
      return { status: 'error', message: 'Unexpected enrolment method.' };
    }
    const qrDataUrl = await QRCode.toDataURL(result.totpURI);
    return { status: 'started', qrDataUrl, backupCodes: result.backupCodes };
  } catch {
    return { status: 'error', message: 'Incorrect password.' };
  }
}

export interface ConfirmEnrollmentState {
  status: 'idle' | 'error';
  message?: string;
}

export const CONFIRM_ENROLLMENT_INITIAL_STATE: ConfirmEnrollmentState = { status: 'idle' };

/** Confirms enrolment with the first code from the authenticator app, completing sign-in. */
export async function confirmEnrollmentAction(
  _previous: ConfirmEnrollmentState,
  formData: FormData,
): Promise<ConfirmEnrollmentState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { status: 'error', message: 'Enter the 6-digit code.' };

  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await nextHeaders() });
  } catch {
    return { status: 'error', message: 'That code did not match.' };
  }

  redirect(ROUTES.dashboard);
}
