'use server';

/**
 * Rule-pack admin actions (implementation.md §5 `rulepacks`, §6.2 SoD-3,
 * §10 P10). The engine/evaluation code paths never read this table — they
 * always import the compiled `OIML_R76_1_2006` constant from
 * `@tula/rulepacks` (§4.11: "publishing a new rule pack never changes an
 * existing evaluation") — this table exists purely for the admin screens
 * (list/detail/clone/edit/diff/publish) and the sandbox comparison below.
 */
import { createHash } from 'node:crypto';
import { evaluations, evaluationTests, rulepacks } from '@tula/db';
import { evaluateTest, loadRulepack, RulepackValidationError } from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import {
  cloneRulepackDraftInputSchema,
  compareRulepackDraftInputSchema,
  instrumentMetrologySchema,
  isImplementedTestCode,
  OBSERVATION_SCHEMAS,
  rulepackRefSchema,
  updateRulepackDraftInputSchema,
} from '@tula/schemas';
import { and, eq } from 'drizzle-orm';
import { ActionError, action } from '@/server/action';
import { assertSod3 } from '@/server/workflow';

function contentHash(content: unknown): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/** Bumps a strict `major.minor.patch` version's minor component — the only shape `loadRulepack`'s schema accepts (no draft-suffix convention exists). */
function bumpMinor(version: string): string {
  const [majorStr, minorStr] = version.split('.');
  const major = Number(majorStr ?? 0);
  const minor = Number(minorStr ?? 0);
  return `${major}.${minor + 1}.0`;
}

function nextDraftVersion(sourceVersion: string, existing: ReadonlySet<string>): string {
  let candidate = bumpMinor(sourceVersion);
  while (existing.has(candidate)) candidate = bumpMinor(candidate);
  return candidate;
}

export const cloneRulepackDraftAction = action(
  {
    schema: cloneRulepackDraftInputSchema,
    permission: 'rulepack.draft',
    audit: {
      action: 'rulepack.clone_draft',
      entityType: 'rulepack',
      entityId: (i) => i.sourceId,
      diff: (_input, result) => result as Record<string, unknown>,
    },
  },
  async ({ sourceId, sourceVersion }, { tx, session }) => {
    const [source] = await tx
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, sourceId), eq(rulepacks.version, sourceVersion)));
    if (!source) throw new ActionError('NOT_FOUND', 'Source rule pack version not found.');

    const existingVersions = await tx
      .select({ version: rulepacks.version })
      .from(rulepacks)
      .where(eq(rulepacks.id, sourceId));
    const version = nextDraftVersion(
      sourceVersion,
      new Set(existingVersions.map((r) => r.version)),
    );

    const sourceVerification = source.content.verification as { source?: string } | undefined;
    // A clone starts unverified even if the source was — it's new content
    // as far as §4.12's "human must complete this checklist" is concerned,
    // and carrying the old verification forward would silently claim a
    // review that never happened for whatever the draft ends up changing.
    const content = {
      ...source.content,
      id: sourceId,
      version,
      verification: {
        verifiedBy: null,
        verifiedAt: null,
        source: sourceVerification?.source ?? '',
      },
    };
    const [row] = await tx
      .insert(rulepacks)
      .values({
        id: sourceId,
        version,
        status: 'DRAFT',
        title: source.title,
        content,
        contentSha256: contentHash(content),
        createdBy: session.user.id,
      })
      .returning({ id: rulepacks.id, version: rulepacks.version });
    if (!row) throw new Error('rulepacks insert returned no row');
    return row;
  },
);

export const updateRulepackDraftAction = action(
  {
    schema: updateRulepackDraftInputSchema,
    permission: 'rulepack.draft',
    audit: {
      action: 'rulepack.update_draft',
      entityType: 'rulepack',
      entityId: (i) => i.id,
    },
  },
  async ({ id, version, content }, { tx }) => {
    const [row] = await tx
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));
    if (!row) throw new ActionError('NOT_FOUND', 'Rule pack version not found.');
    if (row.status !== 'DRAFT') {
      throw new ActionError('CONFLICT', 'Only a draft rule pack can be edited.');
    }
    if (row.publishedBy) {
      // Otherwise the CONTROLLER who confirms would be approving content the
      // ADMIN who initiated never actually saw — SoD-3 is meant to bind two
      // people to the *same* reviewed content, not just two signatures.
      throw new ActionError(
        'CONFLICT',
        'This draft has a pending publish confirmation — cancel it before editing.',
      );
    }

    let validated: Record<string, unknown>;
    try {
      validated = loadRulepack({ ...content, id, version }) as unknown as Record<string, unknown>;
    } catch (error) {
      if (error instanceof RulepackValidationError) {
        throw new ActionError('RULE', error.message);
      }
      throw error;
    }

    await tx
      .update(rulepacks)
      .set({
        content: validated,
        contentSha256: contentHash(validated),
        title: typeof validated.title === 'string' ? validated.title : row.title,
      })
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));

    return { id, version };
  },
);

export const initiateRulepackPublishAction = action(
  {
    schema: rulepackRefSchema,
    permission: 'rulepack.publish',
    audit: { action: 'rulepack.initiate_publish', entityType: 'rulepack', entityId: (i) => i.id },
  },
  async ({ id, version }, { tx, session }) => {
    // §6.2: "ADMIN initiates, CONTROLLER confirms" — both roles hold the
    // `rulepack.publish` permission, so the role split itself is enforced
    // here, not by `can()`.
    if (session.user.role !== 'ADMIN') {
      throw new ActionError('FORBIDDEN', 'Only an administrator can initiate a rule pack publish.');
    }

    const [row] = await tx
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));
    if (!row) throw new ActionError('NOT_FOUND', 'Rule pack version not found.');
    if (row.status !== 'DRAFT') {
      throw new ActionError('CONFLICT', 'Only a draft can be proposed for publishing.');
    }
    if (row.publishedBy) {
      throw new ActionError('CONFLICT', 'This draft already has a pending publish confirmation.');
    }

    try {
      loadRulepack(row.content);
    } catch (error) {
      if (error instanceof RulepackValidationError) {
        throw new ActionError('RULE', `This draft is not valid: ${error.message}`);
      }
      throw error;
    }

    await tx
      .update(rulepacks)
      .set({ publishedBy: session.user.id })
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));

    return { id, version };
  },
);

export const cancelRulepackPublishInitiationAction = action(
  {
    schema: rulepackRefSchema,
    permission: 'rulepack.publish',
    audit: { action: 'rulepack.cancel_publish', entityType: 'rulepack', entityId: (i) => i.id },
  },
  async ({ id, version }, { tx, session }) => {
    if (session.user.role !== 'ADMIN') {
      throw new ActionError('FORBIDDEN', 'Only an administrator can cancel a pending publish.');
    }
    const [row] = await tx
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));
    if (!row) throw new ActionError('NOT_FOUND', 'Rule pack version not found.');
    if (row.status !== 'DRAFT' || !row.publishedBy) {
      throw new ActionError('CONFLICT', 'This draft has no pending publish to cancel.');
    }

    await tx
      .update(rulepacks)
      .set({ publishedBy: null })
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));

    return { id, version };
  },
);

export const confirmRulepackPublishAction = action(
  {
    schema: rulepackRefSchema,
    permission: 'rulepack.publish',
    audit: { action: 'rulepack.confirm_publish', entityType: 'rulepack', entityId: (i) => i.id },
  },
  async ({ id, version }, { tx, session }) => {
    if (session.user.role !== 'CONTROLLER') {
      throw new ActionError('FORBIDDEN', 'Only a controller can confirm a rule pack publish.');
    }

    const [row] = await tx
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));
    if (!row) throw new ActionError('NOT_FOUND', 'Rule pack version not found.');
    if (row.status !== 'DRAFT' || !row.publishedBy) {
      throw new ActionError('CONFLICT', 'This draft has no pending publish to confirm.');
    }

    try {
      assertSod3(row.publishedBy, session.user.id);
    } catch {
      throw new ActionError(
        'RULE',
        'Publishing needs two people: the administrator who initiated it and a different controller to confirm.',
      );
    }

    try {
      loadRulepack(row.content);
    } catch (error) {
      if (error instanceof RulepackValidationError) {
        throw new ActionError('RULE', `This draft is not valid: ${error.message}`);
      }
      throw error;
    }

    const now = new Date();
    await tx
      .update(rulepacks)
      .set({ status: 'RETIRED' })
      .where(and(eq(rulepacks.id, id), eq(rulepacks.status, 'PUBLISHED')));

    await tx
      .update(rulepacks)
      .set({ status: 'PUBLISHED', confirmedBy: session.user.id, publishedAt: now })
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));

    return { id, version };
  },
);

export interface RulepackSandboxComparisonRow {
  testCode: string;
  rangeIndex: number;
  storedVerdict: string | null;
  draftVerdict: string | null;
  changed: boolean;
}

/**
 * "Re-evaluate under draft" (implementation.md §10 P10) — re-runs every
 * completed test of `evaluationId` through the draft rule pack's content
 * and compares the verdict to what's actually stored. Read-only: nothing
 * about the evaluation is touched, matching §4.11's "never changes an
 * existing evaluation" even for a published pack, let alone a draft one.
 */
export const compareRulepackDraftAction = action(
  {
    schema: compareRulepackDraftInputSchema,
    permission: 'rulepack.draft',
    audit: {
      action: 'rulepack.sandbox_compare',
      entityType: 'rulepack',
      entityId: (i) => i.id,
    },
  },
  async ({ id, version, refNo }, { tx, assertLabAccess }) => {
    const [evaluation] = await tx.select().from(evaluations).where(eq(evaluations.refNo, refNo));
    if (!evaluation) throw new ActionError('NOT_FOUND', 'Evaluation not found.');
    await assertLabAccess(evaluation.labId);

    const [draftRow] = await tx
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));
    if (!draftRow) throw new ActionError('NOT_FOUND', 'Rule pack version not found.');

    let draftRulepack: ReturnType<typeof loadRulepack>;
    try {
      draftRulepack = loadRulepack(draftRow.content);
    } catch (error) {
      if (error instanceof RulepackValidationError) {
        throw new ActionError('RULE', `This draft is not valid: ${error.message}`);
      }
      throw error;
    }

    const spec = instrumentMetrologySchema.parse(evaluation.specSnapshot);
    const tests = await tx
      .select()
      .from(evaluationTests)
      .where(
        and(
          eq(evaluationTests.evaluationId, evaluation.id),
          eq(evaluationTests.status, 'COMPLETED'),
        ),
      );

    const results: RulepackSandboxComparisonRow[] = [];
    for (const test of tests) {
      if (!isImplementedTestCode(test.testCode) || !test.observations) continue;
      const schema = OBSERVATION_SCHEMAS[test.testCode];
      const parsed = schema.safeParse(test.observations);
      if (!parsed.success) continue;

      // Always compared against `OIML_R76_1_2006` (the compiled, in-force
      // pack) even though the evaluation may be pinned to an older
      // rulepackVersion — the sandbox question is "what would this look
      // like under the draft, versus how it looks today," not a replay of
      // history.
      let draftVerdict: string | null = null;
      try {
        draftVerdict = evaluateTest(test.testCode, parsed.data, {
          instrument: spec,
          rulepack: draftRulepack,
        }).verdict;
      } catch {
        draftVerdict = null;
      }

      results.push({
        testCode: test.testCode,
        rangeIndex: test.rangeIndex,
        storedVerdict: test.verdict,
        draftVerdict,
        changed: draftVerdict !== test.verdict,
      });
    }

    return { baselineRulepackVersion: OIML_R76_1_2006.version, rows: results };
  },
);
