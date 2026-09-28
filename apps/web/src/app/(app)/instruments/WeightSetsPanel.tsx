'use client';

import { OIML_WEIGHT_CLASSES } from '@tula/schemas';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { MassInput } from '@/components/forms/MassInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createReferenceWeightSetAction } from '@/server/actions/masterdata';
import type { listReferenceWeightSets } from '@/server/queries/masterdata';

type WeightSet = Awaited<ReturnType<typeof listReferenceWeightSets>>[number];

interface ItemRow {
  key: string;
  id: string;
  nominalG: string | null;
  conventionalMassG: string | null;
  uncertaintyMg: string;
}

function newItemRow(): ItemRow {
  return {
    key: crypto.randomUUID(),
    id: '',
    nominalG: null,
    conventionalMassG: null,
    uncertaintyMg: '',
  };
}

async function uploadCertificate(file: File): Promise<string> {
  const form = new FormData();
  form.set('file', file);
  form.set('kind', 'calibration_cert');
  const res = await fetch('/api/v1/files', { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error('Certificate upload failed.');
  return body.data.id as string;
}

function CreateWeightSetForm({ labId, onSuccess }: { labId: string; onSuccess: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oimlClass, setOimlClass] = useState('');
  const [items, setItems] = useState<ItemRow[]>([newItemRow()]);
  const [certFile, setCertFile] = useState<File | null>(null);

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      let certAttachmentId: string | undefined;
      if (certFile) certAttachmentId = await uploadCertificate(certFile);

      const result = await createReferenceWeightSetAction({
        labId,
        setCode: String(formData.get('setCode') ?? ''),
        oimlClass: oimlClass as (typeof OIML_WEIGHT_CLASSES)[number],
        items: items
          .filter((row) => row.nominalG)
          .map((row) => ({
            id: row.id || row.key,
            nominalG: row.nominalG as string,
            conventionalMassG: row.conventionalMassG ?? undefined,
            uncertaintyMg: row.uncertaintyMg || undefined,
          })),
        certNo: String(formData.get('certNo') ?? '') || undefined,
        calibratedOn: String(formData.get('calibratedOn') ?? '') || undefined,
        dueOn: String(formData.get('dueOn') ?? '') || undefined,
        certAttachmentId,
      });

      if (!result.ok) {
        setError(
          result.code === 'VALIDATION'
            ? 'Check the highlighted fields.'
            : 'Could not save. Try again.',
        );
        return;
      }
      toast.success('Reference weight set created');
      onSuccess();
    } catch {
      setError('Certificate upload failed. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
        >
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="setCode">Set code</Label>
          <Input id="setCode" name="setCode" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oimlClass">OIML class</Label>
          <Select value={oimlClass} onValueChange={setOimlClass} required>
            <SelectTrigger id="oimlClass" className="w-full">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {OIML_WEIGHT_CLASSES.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Items</Label>
        {items.map((row) => (
          <div
            key={row.key}
            className="flex items-end gap-2 rounded-[var(--radius-control)] border border-border p-2"
          >
            <MassInput
              label="Nominal"
              value={row.nominalG}
              onChange={(v) => updateItem(row.key, { nominalG: v })}
              assumedUnit="g"
              className="flex-1"
            />
            <MassInput
              label="Conventional mass"
              value={row.conventionalMassG}
              onChange={(v) => updateItem(row.key, { conventionalMassG: v })}
              assumedUnit="g"
              className="flex-1"
            />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`uncertainty-${row.key}`}>Uncertainty (mg)</Label>
              <Input
                id={`uncertainty-${row.key}`}
                value={row.uncertaintyMg}
                onChange={(e) => updateItem(row.key, { uncertaintyMg: e.target.value })}
                inputMode="decimal"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove item"
              disabled={items.length === 1}
              onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setItems((prev) => [...prev, newItemRow()])}
        >
          <Plus className="size-4" />
          Add item
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="certNo">Certificate no.</Label>
          <Input id="certNo" name="certNo" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calibratedOn">Calibrated on</Label>
          <Input id="calibratedOn" name="calibratedOn" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueOn">Due on</Label>
          <Input id="dueOn" name="dueOn" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="certFile">Calibration certificate (PDF/image)</Label>
          <Input
            id="certFile"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={pending || !oimlClass}>
          {pending ? 'Saving…' : 'Create weight set'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function WeightSetsTable({ weightSets }: { weightSets: WeightSet[] }) {
  if (weightSets.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No reference weight sets yet.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Set code</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Certificate</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {weightSets.map((set) => (
          <TableRow key={set.id}>
            <TableCell className="tabular font-medium">{set.setCode}</TableCell>
            <TableCell>{set.oimlClass}</TableCell>
            <TableCell className="tabular">{set.certNo ?? '—'}</TableCell>
            <TableCell className="tabular">{set.dueOn ?? '—'}</TableCell>
            <TableCell>
              {set.expired ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  Calibration expired
                </Badge>
              ) : (
                <Badge variant="outline">{set.status}</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WeightSetsPanel({ weightSets, labId }: { weightSets: WeightSet[]; labId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Reference weight sets</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              New weight set
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New reference weight set</DialogTitle>
            </DialogHeader>
            <CreateWeightSetForm
              labId={labId}
              onSuccess={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <WeightSetsTable weightSets={weightSets} />
    </section>
  );
}
