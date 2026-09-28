'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ModuleRow {
  key: string;
  type: 'indicator' | 'load_cell';
  manufacturer: string;
  model: string;
  approvalNo: string;
}

export function newModuleRow(): ModuleRow {
  return {
    key: crypto.randomUUID(),
    type: 'indicator',
    manufacturer: '',
    model: '',
    approvalNo: '',
  };
}

/** Indicator + load-cell rows (implementation.md §5, §7.5: "modules form"). */
export function ModulesEditor({
  modules,
  onChange,
}: {
  modules: ModuleRow[];
  onChange: (next: ModuleRow[]) => void;
}) {
  function update(key: string, patch: Partial<ModuleRow>) {
    onChange(modules.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  return (
    <div className="space-y-2">
      {modules.map((row) => (
        <div
          key={row.key}
          className="flex items-end gap-2 rounded-[var(--radius-control)] border border-border p-2"
        >
          <div className="w-32 space-y-1.5">
            <Label htmlFor={`module-type-${row.key}`}>Type</Label>
            <Select
              value={row.type}
              onValueChange={(v) => update(row.key, { type: v as ModuleRow['type'] })}
            >
              <SelectTrigger id={`module-type-${row.key}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="indicator">Indicator</SelectItem>
                <SelectItem value="load_cell">Load cell</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`module-manufacturer-${row.key}`}>Manufacturer</Label>
            <Input
              id={`module-manufacturer-${row.key}`}
              value={row.manufacturer}
              onChange={(e) => update(row.key, { manufacturer: e.target.value })}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`module-model-${row.key}`}>Model</Label>
            <Input
              id={`module-model-${row.key}`}
              value={row.model}
              onChange={(e) => update(row.key, { model: e.target.value })}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`module-approval-${row.key}`}>Approval no.</Label>
            <Input
              id={`module-approval-${row.key}`}
              value={row.approvalNo}
              onChange={(e) => update(row.key, { approvalNo: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove module"
            onClick={() => onChange(modules.filter((m) => m.key !== row.key))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...modules, newModuleRow()])}
      >
        <Plus className="size-4" />
        Add module
      </Button>
    </div>
  );
}
