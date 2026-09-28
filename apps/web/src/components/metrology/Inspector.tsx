import { type EnvelopePoint, ErrorEnvelopeChart } from '@/components/charts/ErrorEnvelopeChart';
import { EvidenceGallery } from '@/components/forms/EvidenceGallery';
import { Button } from '@/components/ui/button';
import type { CompletionBlocker } from '@/lib/completion-blockers';

/**
 * The right-hand Inspector panel (implementation.md §7.5's reference
 * layout): result summary, error envelope, conditions, evidence, guidance
 * link. `blockers` (from `computeFastCompletionBlockers`) is what disables
 * **Mark test complete** and lists why — the standards guard is server-only
 * (see `lib/completion-blockers.ts`), so it can surface a blocker only
 * after a click, via the toast/error message, not pre-disabled here.
 */
export function Inspector({
  testId,
  clause,
  summary,
  points,
  blockers,
  readOnly,
  canComplete,
  onComplete,
  completing,
}: {
  testId: string;
  clause?: string;
  summary: { pass: number; fail: number; open: number; maxAbsEcInE: string | null };
  points: EnvelopePoint[];
  blockers: CompletionBlocker[];
  readOnly: boolean;
  canComplete: boolean;
  onComplete: () => void;
  completing: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">Result</p>
        <p className="tabular text-sm text-muted-foreground">
          {summary.pass} pass, {summary.fail} fail, {summary.open} open
        </p>
        {summary.maxAbsEcInE ? (
          <p className="tabular text-sm">Max |Ec| {summary.maxAbsEcInE} e</p>
        ) : null}
        <ErrorEnvelopeChart points={points} />
      </div>

      <EvidenceGallery testId={testId} disabled={readOnly} />

      {clause ? (
        <p className="text-sm">
          Guidance <span className="tabular text-muted-foreground">clause {clause}</span>
        </p>
      ) : null}

      {!readOnly ? (
        <div className="space-y-2 border-t border-border pt-4">
          {blockers.length > 0 ? (
            <ul className="space-y-1 text-sm text-fail">
              {blockers.map((b) => (
                <li key={b.code}>{b.message}</li>
              ))}
            </ul>
          ) : null}
          <Button onClick={onComplete} disabled={!canComplete || completing} className="w-full">
            {completing ? 'Marking complete…' : 'Mark test complete'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
