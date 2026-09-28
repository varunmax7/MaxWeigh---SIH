/**
 * The one wrapper every mutation goes through (implementation.md §6.2, §11
 * "Server code"): Zod parse → session → permission → lab scope → transaction
 * (handler + audit). A handler that never ran (a validation or permission
 * failure) never touches the database except to log the denial.
 *
 * "Lab scope" is enforced by `ctx.assertLabAccess(labId)` rather than by the
 * wrapper itself: the wrapper cannot know which lab an action touches until
 * the handler has looked up the target entity (an evaluation id, say), so it
 * hands the handler a scoping check to call once it knows. See
 * docs/QUESTIONS.md.
 */

import { type DbTx, insertAuditEntry, labMembers } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
// The `@/` alias — see the comment in server/auth.ts on why a relative
// import here can fail to resolve under Turbopack (Next 16.3.6).
import { db } from '@/server/db';
import { can, type Permission } from '@/server/rbac';
import { type AppSession, getSession } from '@/server/session';

export type ActionErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'CONFLICT' | 'NOT_FOUND' | 'RULE';

export type ActionResult<R> =
  | { ok: true; data: R }
  | { ok: false; code: ActionErrorCode; issues?: unknown };

/** Thrown by a handler to fail the action with a specific, typed outcome. */
export class ActionError extends Error {
  constructor(
    readonly code: Exclude<ActionErrorCode, 'VALIDATION'>,
    message: string,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}

export interface ActionCtx {
  tx: DbTx;
  session: AppSession;
  /** Throws `ActionError('FORBIDDEN', …)` unless the session's user belongs to `labId`. */
  assertLabAccess: (labId: string) => Promise<void>;
}

export interface AuditSpec<TInput> {
  action: string;
  entityType: string;
  /** The audited entity, if any — computed from the input alone, so it is available even when the handler never runs. */
  entityId?: (input: TInput) => string | null;
  /** The lab an entity belongs to, if known from the input alone (e.g. creating a new evaluation). */
  labId?: (input: TInput) => string | null;
  /** Computed only on success, from the input and the handler's result. */
  diff?: (input: TInput, result: unknown) => Record<string, unknown> | null;
}

export interface ActionOptions<S extends z.ZodTypeAny> {
  schema: S;
  permission: Permission;
  audit: AuditSpec<z.infer<S>>;
}

async function writeDenied<TInput>(
  spec: AuditSpec<TInput>,
  input: TInput,
  session: AppSession | null,
  reason: string,
): Promise<void> {
  await db.transaction((tx) =>
    insertAuditEntry(tx, {
      actorId: session?.user.id ?? null,
      actorRole: session?.user.role ?? null,
      labId: spec.labId?.(input) ?? null,
      action: spec.action,
      entityType: spec.entityType,
      entityId: spec.entityId?.(input) ?? null,
      diff: { denied: true, reason },
      ip: null,
      userAgent: null,
    }),
  );
}

/**
 * Builds a server action. `handler` runs only once parsing, session and
 * permission checks all pass; its return value becomes `data` and its
 * outcome (success, or an `ActionError`) is written to the audit ledger in
 * the same transaction.
 */
export function action<S extends z.ZodTypeAny, R>(
  opts: ActionOptions<S>,
  handler: (input: z.infer<S>, ctx: ActionCtx) => Promise<R>,
) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, code: 'VALIDATION', issues: parsed.error.issues };
    }
    const input = parsed.data;

    const session = await getSession();
    if (!session) {
      await writeDenied(opts.audit, input, null, 'NO_SESSION');
      return { ok: false, code: 'FORBIDDEN' };
    }

    if (!can(session.user.role, opts.permission)) {
      await writeDenied(opts.audit, input, session, 'MISSING_PERMISSION');
      return { ok: false, code: 'FORBIDDEN' };
    }

    try {
      const result = await db.transaction(async (tx) => {
        const assertLabAccess = async (labId: string): Promise<void> => {
          const [membership] = await tx
            .select({ userId: labMembers.userId })
            .from(labMembers)
            .where(and(eq(labMembers.userId, session.user.id), eq(labMembers.labId, labId)));
          if (!membership) {
            throw new ActionError('FORBIDDEN', `user is not a member of lab ${labId}`);
          }
        };

        const data = await handler(input, { tx, session, assertLabAccess });

        await insertAuditEntry(tx, {
          actorId: session.user.id,
          actorRole: session.user.role,
          labId: opts.audit.labId?.(input) ?? null,
          action: opts.audit.action,
          entityType: opts.audit.entityType,
          entityId: opts.audit.entityId?.(input) ?? null,
          diff: opts.audit.diff?.(input, data) ?? null,
          ip: null,
          userAgent: null,
        });

        return data;
      });

      return { ok: true, data: result };
    } catch (error) {
      if (error instanceof ActionError) {
        return { ok: false, code: error.code };
      }
      throw error;
    }
  };
}
