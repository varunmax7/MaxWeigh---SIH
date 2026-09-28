'use client';

import type { Issue } from '@tula/engine';
import { SpecEditor } from '@/components/forms/SpecEditor';
import { ClassificationPanel } from '@/components/metrology';
import type { SpecState } from '@/lib/spec-state';

/**
 * Step 3 (implementation.md §7.5): "Metrology parameters — prefilled from
 * model, editable, live classification panel on the right." Reuses P4's
 * `SpecEditor`/`ClassificationPanel` as-is — the same engine call runs here
 * and in `server/actions/evaluations.ts`'s `assertSpecClassifies`, so the
 * wizard can never show "valid" for a spec the server would reject.
 */
export function Step3Metrology({
  spec,
  onChange,
  issues,
}: {
  spec: SpecState;
  onChange: (s: SpecState) => void;
  issues: Issue[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <SpecEditor spec={spec} onChange={onChange} />
      <div className="space-y-2">
        <p className="text-sm font-medium">Classification</p>
        <ClassificationPanel issues={issues} />
      </div>
    </div>
  );
}
