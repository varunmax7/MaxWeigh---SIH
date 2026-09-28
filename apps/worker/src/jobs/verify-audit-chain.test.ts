import { describe, expect, it, vi } from 'vitest';
import { logger } from '../logger.js';
import { makeVerifyAuditChain } from './verify-audit-chain.js';

vi.mock('@tula/db', () => ({ verifyChain: vi.fn() }));

describe('makeVerifyAuditChain', () => {
  it('logs at info level when the chain is intact', async () => {
    const { verifyChain } = await import('@tula/db');
    vi.mocked(verifyChain).mockResolvedValueOnce({ ok: true, rowsChecked: 42 });
    const infoSpy = vi.spyOn(logger, 'info');

    // biome-ignore lint/suspicious/noExplicitAny: a fake Db is enough — verifyChain itself is mocked.
    await makeVerifyAuditChain({} as any)();

    expect(infoSpy).toHaveBeenCalledWith({ rowsChecked: 42 }, 'audit chain verified');
    infoSpy.mockRestore();
  });

  it('logs at error level with the broken row id when the chain is tampered', async () => {
    const { verifyChain } = await import('@tula/db');
    vi.mocked(verifyChain).mockResolvedValueOnce({
      ok: false,
      brokenId: 7n,
      reason: 'hash_mismatch',
    });
    const errorSpy = vi.spyOn(logger, 'error');

    // biome-ignore lint/suspicious/noExplicitAny: a fake Db is enough — verifyChain itself is mocked.
    await makeVerifyAuditChain({} as any)();

    expect(errorSpy).toHaveBeenCalledWith(
      { brokenId: '7', reason: 'hash_mismatch' },
      'audit chain integrity check FAILED',
    );
    errorSpy.mockRestore();
  });
});
