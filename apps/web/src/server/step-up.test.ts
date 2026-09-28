import { describe, expect, it, vi } from 'vitest';

const verifyTOTP = vi.fn();

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/server/auth', () => ({ auth: { api: { verifyTOTP } } }));

const { assertStepUp } = await import('./step-up.js');
const { ActionError } = await import('./action.js');

describe('assertStepUp', () => {
  it('passes the code through to Better Auth and resolves when it verifies', async () => {
    verifyTOTP.mockResolvedValueOnce({ token: 'session-token' });
    await expect(assertStepUp('123456')).resolves.toBeUndefined();
    expect(verifyTOTP).toHaveBeenCalledWith(expect.objectContaining({ body: { code: '123456' } }));
  });

  it('turns any verification failure into one FORBIDDEN, never leaking which', async () => {
    verifyTOTP.mockRejectedValueOnce(new Error('TOTP_NOT_ENABLED'));
    const rejected = await assertStepUp('000000').catch((error: unknown) => error);

    expect(rejected).toBeInstanceOf(ActionError);
    expect((rejected as InstanceType<typeof ActionError>).code).toBe('FORBIDDEN');
    expect((rejected as Error).message).not.toContain('TOTP_NOT_ENABLED');
  });
});
