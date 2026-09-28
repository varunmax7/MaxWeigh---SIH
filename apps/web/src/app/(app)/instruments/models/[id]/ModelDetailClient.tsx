'use client';

import type { InstrumentMetrology } from '@tula/engine';
import {
  INSTRUMENT_TYPES,
  instrumentMetrologySchema,
  instrumentModulesSchema,
} from '@tula/schemas';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ClassificationPanel } from '@/components/metrology';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { classifyInstrument } from '@/lib/classify';
import { updateInstrumentModelAction } from '@/server/actions/masterdata';
import type { getInstrumentModel, listManufacturers } from '@/server/queries/masterdata';
import { type ModuleRow, ModulesEditor } from './ModulesEditor';
import { SpecEditor } from './SpecEditor';
import {
  emptySpecState,
  type SpecState,
  specStateFromMetrology,
  toInstrumentMetrology,
} from './spec-state';

type Model = NonNullable<Awaited<ReturnType<typeof getInstrumentModel>>>;
type Manufacturer = Awaited<ReturnType<typeof listManufacturers>>[number];

function parseStoredSpec(raw: unknown): SpecState {
  if (!raw) return emptySpecState();
  const result = instrumentMetrologySchema.safeParse(raw);
  if (!result.success) return emptySpecState();
  return specStateFromMetrology(result.data as InstrumentMetrology);
}

function parseStoredModules(raw: unknown): ModuleRow[] {
  const result = instrumentModulesSchema.safeParse(raw ?? []);
  if (!result.success) return [];
  return result.data.map((m) => ({
    key: crypto.randomUUID(),
    ...m,
    approvalNo: m.approvalNo ?? '',
  }));
}

export function ModelDetailClient({
  model,
  manufacturers,
}: {
  model: Model;
  manufacturers: Manufacturer[];
}) {
  const router = useRouter();
  const [manufacturerId, setManufacturerId] = useState(model.manufacturerId);
  const [modelName, setModelName] = useState(model.modelName);
  const [instrumentType, setInstrumentType] = useState(model.instrumentType);
  const [variantNames, setVariantNames] = useState((model.variantNames ?? []).join(', '));
  const [description, setDescription] = useState(model.description ?? '');
  const [spec, setSpec] = useState<SpecState>(() => parseStoredSpec(model.defaultSpec));
  const [modules, setModules] = useState<ModuleRow[]>(() => parseStoredModules(model.modules));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSpec = useMemo(() => toInstrumentMetrology(spec), [spec]);
  const issues = useMemo(
    () => (resolvedSpec ? classifyInstrument(resolvedSpec) : []),
    [resolvedSpec],
  );
  const hasErrors = issues.some((i) => i.severity === 'error');

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateInstrumentModelAction({
      id: model.id,
      manufacturerId,
      modelName,
      instrumentType,
      variantNames: variantNames
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      description: description || undefined,
      defaultSpec: resolvedSpec ?? undefined,
      modules: modules.map(({ key: _key, ...rest }) => rest),
    });
    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'RULE'
          ? 'Fix the blocking classification issues before saving.'
          : result.code === 'VALIDATION'
            ? 'Check the highlighted fields.'
            : 'Could not save. Try again.',
      );
      return;
    }
    toast.success('Instrument model saved');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
        >
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="detail-manufacturer">Manufacturer</Label>
          <Select value={manufacturerId} onValueChange={setManufacturerId}>
            <SelectTrigger id="detail-manufacturer" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {manufacturers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="detail-modelName">Model name</Label>
          <Input
            id="detail-modelName"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="detail-type">Instrument type</Label>
          <Select
            value={instrumentType}
            onValueChange={(v) => setInstrumentType(v as typeof instrumentType)}
          >
            <SelectTrigger id="detail-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTRUMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="detail-variants">Variant names</Label>
          <Input
            id="detail-variants"
            value={variantNames}
            onChange={(e) => setVariantNames(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="detail-description">Description</Label>
        <Input
          id="detail-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Tabs defaultValue="spec">
        <TabsList>
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="spec" className="space-y-6 pt-4">
          <SpecEditor spec={spec} onChange={setSpec} />

          <div className="space-y-2">
            <Label>Modules</Label>
            <ModulesEditor modules={modules} onChange={setModules} />
          </div>

          <div className="space-y-2">
            <Label>Classification</Label>
            {resolvedSpec ? (
              <ClassificationPanel issues={issues} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Fill in the required spec fields to see classification results.
              </p>
            )}
          </div>

          <Button onClick={handleSave} disabled={pending || hasErrors}>
            {pending ? 'Saving…' : 'Save model'}
          </Button>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <p className="py-8 text-center text-sm text-muted-foreground">
            No evaluations yet for this model.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
