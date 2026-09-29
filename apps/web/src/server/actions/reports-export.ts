'use server';

import { exportReportsZipInputSchema } from '@tula/schemas';
import { action } from '@/server/action';
import { enqueue } from '@/server/jobs';
import { QUEUES } from '@/server/queues';

/**
 * Enqueues `reports.export` (implementation.md §10 P9 "bulk ZIP export
 * job"). The job itself is the worker's — this action only validates the
 * filters, checks `report.export` and hands off; completion is surfaced as
 * a `reports.export_ready` notification (`server/notify.ts`'s existing
 * pattern), since a ZIP of every matching PDF/DOCX can take longer than one
 * request should hold a connection open for.
 */
export const exportReportsZipAction = action(
  {
    schema: exportReportsZipInputSchema,
    permission: 'report.export',
    audit: {
      action: 'reports.export',
      entityType: 'lab',
      entityId: (i) => i.labId,
      labId: (i) => i.labId,
    },
  },
  async ({ labId, filters }, { session, assertLabAccess }) => {
    await assertLabAccess(labId);
    await enqueue(QUEUES.reportsExport, { labId, filters, requestedBy: session.user.id });
    return { queued: true };
  },
);
