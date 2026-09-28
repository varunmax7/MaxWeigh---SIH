/**
 * Review, approval and comment schemas (implementation.md §6.3, §7.5
 * "Review screen", §10 P7).
 *
 * A tier decision carries the `modelSha256` the reviewer was looking at:
 * §6.3 binds approvals to the report model's content hash, so the server
 * rejects a decision taken against a version that has since been superseded
 * rather than silently approving different data.
 */
import { z } from 'zod';

export const REVIEW_DECISIONS = ['APPROVE', 'RETURN'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** The three signatory tiers (implementation.md §6.2: STO, CMO, Controller). */
export const REVIEW_TIERS = [1, 2, 3] as const;
export type ReviewTier = (typeof REVIEW_TIERS)[number];

/** A fresh TOTP code (implementation.md §9 "Step-up"): 6 digits, no spaces. */
export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.');

export const submitForReviewInputSchema = z.object({
  evaluationId: z.uuid(),
});

export const reviewDecisionInputSchema = z.object({
  evaluationId: z.uuid(),
  /** What the reviewer saw — compared against the current version's hash. */
  modelSha256: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(REVIEW_DECISIONS),
  totpCode: totpCodeSchema,
  /** Required on RETURN (implementation.md §7.5: "Return with comments"). */
  comment: z.string().trim().min(1).optional(),
});

export const commentInputSchema = z.object({
  evaluationId: z.uuid(),
  /** Anchors the thread to one test; absent for an evaluation-level note. */
  testId: z.uuid().optional(),
  /** Anchors it further to one observation row, e.g. `asc:3` (implementation.md §5 `comments.row_ref`). */
  rowRef: z.string().trim().min(1).max(64).optional(),
  parentId: z.uuid().optional(),
  body: z.string().trim().min(1).max(4000),
});

export const resolveCommentInputSchema = z.object({
  commentId: z.uuid(),
});

export const markNotificationsReadInputSchema = z.object({
  /** Empty marks every unread notification read. */
  ids: z.array(z.uuid()).default([]),
});

/** `notifications.type` — one per workflow event that needs someone's attention. */
export const NOTIFICATION_TYPES = ['review.pending', 'review.returned', 'review.approved'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
