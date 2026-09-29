export interface StartEnrollmentState {
  status: 'idle' | 'error' | 'started';
  message?: string;
  qrDataUrl?: string;
  backupCodes?: string[];
}

export const START_ENROLLMENT_INITIAL_STATE: StartEnrollmentState = { status: 'idle' };

export interface ConfirmEnrollmentState {
  status: 'idle' | 'error';
  message?: string;
}

export const CONFIRM_ENROLLMENT_INITIAL_STATE: ConfirmEnrollmentState = { status: 'idle' };
