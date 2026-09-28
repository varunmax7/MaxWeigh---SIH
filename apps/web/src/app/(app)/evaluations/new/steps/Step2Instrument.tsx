'use client';

import { INSTRUMENT_TYPES } from '@tula/schemas';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import { createInstrumentModelAction } from '@/server/actions/masterdata';
import type { listInstrumentModels } from '@/server/queries/masterdata';

type Model = Awaited<ReturnType<typeof listInstrumentModels>>[number];

function QuickCreateModel({
  manufacturerId,
  manufacturerName,
  onCreated,
}: {
  manufacturerId: string;
  manufacturerName: string;
  onCreated: (m: Model) => void;
}) {
  const [open, setOpen] = useState(false);
  const [modelName, setModelName] = useState('');
  const [instrumentType, setInstrumentType] = useState<(typeof INSTRUMENT_TYPES)[number]>('bench');
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    setPending(true);
    const result = await createInstrumentModelAction({
      manufacturerId,
      modelName,
      instrumentType,
      variantNames: [],
    });
    setPending(false);
    if (!result.ok) {
      toast.error('Could not create instrument model.');
      return;
    }
    onCreated({
      id: result.data.id,
      modelName,
      variantNames: [],
      instrumentType,
      manufacturerId,
      manufacturerName,
      hasDefaultSpec: false,
      createdAt: new Date(),
    });
    setModelName('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!manufacturerId}>
          New model
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New instrument model</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-model-name">Model name</Label>
            <Input
              id="quick-model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-model-type">Instrument type</Label>
            <Select
              value={instrumentType}
              onValueChange={(v) => setInstrumentType(v as typeof instrumentType)}
            >
              <SelectTrigger id="quick-model-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Metrology parameters are set in the next step.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={pending || !modelName.trim()}>
            {pending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Step 2 (implementation.md §7.5): "Instrument (pick model or create inline; sample serial numbers)." */
export function Step2Instrument({
  models,
  manufacturerId,
  manufacturerName,
  modelId,
  sampleSerials,
  onModelChange,
  onSampleSerialsChange,
  onModelCreated,
}: {
  models: Model[];
  manufacturerId: string;
  manufacturerName: string;
  modelId: string;
  sampleSerials: string;
  onModelChange: (id: string) => void;
  onSampleSerialsChange: (v: string) => void;
  onModelCreated: (m: Model) => void;
}) {
  const modelsForManufacturer = useMemo(
    () => models.filter((m) => m.manufacturerId === manufacturerId),
    [models, manufacturerId],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="step2-model">Instrument model</Label>
          <QuickCreateModel
            manufacturerId={manufacturerId}
            manufacturerName={manufacturerName}
            onCreated={onModelCreated}
          />
        </div>
        <Select value={modelId} onValueChange={onModelChange}>
          <SelectTrigger id="step2-model" className="w-full">
            <SelectValue
              placeholder={
                modelsForManufacturer.length === 0
                  ? 'No models for this manufacturer yet'
                  : 'Choose a model'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {modelsForManufacturer.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.modelName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="step2-serials">Sample serial numbers</Label>
        <Input
          id="step2-serials"
          value={sampleSerials}
          onChange={(e) => onSampleSerialsChange(e.target.value)}
          placeholder="Comma-separated, e.g. SN-2201, SN-2202"
        />
      </div>
    </div>
  );
}
