'use client';

import { EVALUATION_PRIORITIES } from '@tula/schemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { listTesters } from '@/server/queries/evaluations';

type Tester = Awaited<ReturnType<typeof listTesters>>[number];

const NO_TESTER = '__unassigned__';

/** Step 5 (implementation.md §7.5): "Assignment — tester, due date, priority." */
export function Step5Assignment({
  testers,
  assignedTesterId,
  dueAt,
  priority,
  onAssignedTesterChange,
  onDueAtChange,
  onPriorityChange,
}: {
  testers: Tester[];
  assignedTesterId: string;
  dueAt: string;
  priority: (typeof EVALUATION_PRIORITIES)[number];
  onAssignedTesterChange: (id: string) => void;
  onDueAtChange: (v: string) => void;
  onPriorityChange: (p: (typeof EVALUATION_PRIORITIES)[number]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="step5-tester">Tester</Label>
        <Select
          value={assignedTesterId || NO_TESTER}
          onValueChange={(v) => onAssignedTesterChange(v === NO_TESTER ? '' : v)}
        >
          <SelectTrigger id="step5-tester" className="w-full">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TESTER}>Unassigned</SelectItem>
            {testers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="step5-due">Due date</Label>
        <Input
          id="step5-due"
          type="date"
          value={dueAt}
          onChange={(e) => onDueAtChange(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="step5-priority">Priority</Label>
        <Select value={priority} onValueChange={(v) => onPriorityChange(v as typeof priority)}>
          <SelectTrigger id="step5-priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVALUATION_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
