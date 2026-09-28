import type { Issue } from '@tula/engine';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { issueMessage } from '@/lib/issue-messages';
import { cn } from '@/lib/utils';

const SEVERITY_ORDER: Record<Issue['severity'], number> = { error: 0, warning: 1, info: 2 };

const SEVERITY_STYLE: Record<Issue['severity'], { icon: typeof AlertCircle; className: string }> = {
  error: { icon: AlertCircle, className: 'text-fail bg-fail-bg' },
  warning: { icon: AlertCircle, className: 'text-pending bg-pending-bg' },
  info: { icon: Info, className: 'text-active bg-active-bg' },
};

/**
 * Live classification feedback (implementation.md §7.5: "live
 * classification panel"), driven entirely by `@tula/engine`'s
 * `validateInstrument` output (via `lib/classify.ts`) — this component only
 * renders `Issue[]`, it never decides what is or isn't a violation.
 */
export function ClassificationPanel({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-panel)] border border-border bg-pass-bg px-3 py-2 text-sm text-pass">
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        Classification valid — no issues.
      </div>
    );
  }

  const sorted = [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <ul className="space-y-2">
      {sorted.map((issue) => {
        const { icon: Icon, className } = SEVERITY_STYLE[issue.severity];
        const key = `${issue.code}-${issue.path ?? ''}-${JSON.stringify(issue.params)}`;
        return (
          <li
            key={key}
            className={cn(
              'flex items-start gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm',
              className,
            )}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">
              {issueMessage(issue)}
              {issue.clause ? (
                <span className="tabular ml-1.5 text-xs opacity-80">clause {issue.clause}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
