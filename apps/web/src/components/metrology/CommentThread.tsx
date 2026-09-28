'use client';

import { CheckCircle2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { addCommentAction, resolveCommentAction } from '@/server/actions/comments';

export interface CommentRow {
  id: string;
  testId: string | null;
  rowRef: string | null;
  tier: number | null;
  body: string;
  resolvedAt: Date | null;
  createdAt: Date;
  authorName: string;
}

function CommentItem({
  comment,
  canWrite,
  testLabelById,
  resolving,
  onResolve,
}: {
  comment: CommentRow;
  canWrite: boolean;
  testLabelById: Map<string, string>;
  resolving: boolean;
  onResolve: () => void;
}) {
  return (
    <li
      className={cn(
        'space-y-1 rounded-[var(--radius-control)] border border-border p-3 text-sm',
        comment.resolvedAt && 'opacity-60',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">
          {comment.authorName}
          {comment.tier ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              tier {comment.tier}
            </span>
          ) : null}
        </p>
        <span className="tabular text-xs text-muted-foreground">
          {comment.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
        </span>
      </div>
      {comment.testId ? (
        <p className="text-xs text-muted-foreground">
          <MessageSquare aria-hidden="true" className="mr-1 inline size-3" />
          {testLabelById.get(comment.testId) ?? 'Unknown test'}
          {comment.rowRef ? ` · row ${comment.rowRef}` : ''}
        </p>
      ) : null}
      <p>{comment.body}</p>
      {comment.resolvedAt ? (
        <p className="flex items-center gap-1 text-xs text-pass">
          <CheckCircle2 aria-hidden="true" className="size-3" />
          Resolved
        </p>
      ) : canWrite ? (
        <Button variant="ghost" size="xs" onClick={onResolve} disabled={resolving}>
          {resolving ? 'Resolving…' : 'Resolve'}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Comment threads anchored to a test or a row (implementation.md §7.5). One
 * flat, chronological list rather than a nested tree — `comments.parent_id`
 * exists in the schema for a future reply view, but a review conversation on
 * one evaluation rarely runs more than a handful deep, and a flat list reads
 * faster than expand/collapse would for that size.
 */
export function CommentThread({
  evaluationId,
  comments,
  canWrite,
  anchors,
}: {
  evaluationId: string;
  comments: CommentRow[];
  canWrite: boolean;
  /** Tests the composer can anchor a new comment to, and the lookup the
   * thread's anchor line reads from (§7.5: "anchored to a test or a row").
   * Plain data, not a function — a Server Component prop must be
   * serializable across the RSC boundary. */
  anchors: { testId: string; label: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [anchorTestId, setAnchorTestId] = useState('');
  const [posting, setPosting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const testLabelById = useMemo(() => new Map(anchors.map((a) => [a.testId, a.label])), [anchors]);

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    const result = await addCommentAction({
      evaluationId,
      testId: anchorTestId || undefined,
      body: trimmed,
    });
    setPosting(false);
    if (!result.ok) {
      toast.error('Could not post the comment.');
      return;
    }
    setBody('');
    toast.success('Comment posted');
    router.refresh();
  }

  async function handleResolve(commentId: string) {
    setResolvingId(commentId);
    const result = await resolveCommentAction({ commentId });
    setResolvingId(null);
    if (!result.ok) {
      toast.error('Could not resolve the comment.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canWrite={canWrite}
              testLabelById={testLabelById}
              resolving={resolvingId === comment.id}
              onResolve={() => handleResolve(comment.id)}
            />
          ))}
        </ul>
      )}

      {canWrite ? (
        <div className="space-y-2 border-t border-border pt-3">
          {anchors.length > 0 ? (
            <select
              value={anchorTestId}
              onChange={(e) => setAnchorTestId(e.target.value)}
              className="h-8 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2 text-sm"
              aria-label="Anchor this comment to a test"
            >
              <option value="">General comment (not anchored to a test)</option>
              {anchors.map((a) => (
                <option key={a.testId} value={a.testId}>
                  {a.label}
                </option>
              ))}
            </select>
          ) : null}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
          />
          <Button size="sm" onClick={handlePost} disabled={posting || !body.trim()}>
            {posting ? 'Posting…' : 'Post comment'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
