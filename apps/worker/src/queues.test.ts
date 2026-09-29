import { describe, expect, it } from 'vitest';
import { ALL_QUEUES, QUEUES } from './queues.js';

describe('worker queues', () => {
  it('declares every queue named in the architecture', () => {
    expect([...ALL_QUEUES].sort()).toEqual([
      'analytics.refresh',
      'audit.verify',
      'docx.build',
      'notify.email',
      'report.render',
      'report.sign',
      'reports.export',
      'thumb.make',
    ]);
  });

  it('uses dotted, namespaced queue names', () => {
    for (const name of Object.values(QUEUES)) {
      expect(name).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
});
