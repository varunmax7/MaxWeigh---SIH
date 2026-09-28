'use server';

import { labs } from '@tula/db';
import { labSettingsInputSchema } from '@tula/schemas';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { action } from '@/server/action';

const updateLabSettingsSchema = labSettingsInputSchema.extend({ labId: z.uuid() });

/** implementation.md §7.5 Settings: "lab profile, logo, numbering patterns, signatory titles, SLA hours". */
export const updateLabSettingsAction = action(
  {
    schema: updateLabSettingsSchema,
    permission: 'settings.manage',
    audit: {
      action: 'lab.update_settings',
      entityType: 'lab',
      entityId: (i) => i.labId,
      labId: (i) => i.labId,
    },
  },
  async ({ labId, settings, ...profile }, { tx, assertLabAccess }) => {
    await assertLabAccess(labId);
    await tx
      .update(labs)
      .set({
        ...profile,
        ...(settings
          ? {
              settings: sql`coalesce(${labs.settings}, '{}'::jsonb) || ${JSON.stringify(settings)}::jsonb`,
            }
          : {}),
      })
      .where(eq(labs.id, labId));
    return { id: labId };
  },
);
