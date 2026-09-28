'use client';

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { INSTRUMENT_TYPES } from '@tula/schemas';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import { ROUTES } from '@/lib/routes';
import { createInstrumentModelAction } from '@/server/actions/masterdata';
import type { listInstrumentModels, listManufacturers } from '@/server/queries/masterdata';

type Model = Awaited<ReturnType<typeof listInstrumentModels>>[number];
type Manufacturer = Awaited<ReturnType<typeof listManufacturers>>[number];

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const helper = createColumnHelper<typeof features, Model>();
const columns = helper.columns([
  helper.accessor('modelName', { header: 'Model' }),
  helper.accessor('manufacturerName', { header: 'Manufacturer' }),
  helper.accessor('instrumentType', { header: 'Type' }),
  helper.accessor('hasDefaultSpec', {
    header: 'Spec',
    cell: (info) => (
      <Badge variant={info.getValue() ? 'default' : 'outline'}>
        {info.getValue() ? 'Set' : 'Not set'}
      </Badge>
    ),
  }),
]);

function CreateModelForm({
  manufacturers,
  onSuccess,
}: {
  manufacturers: Manufacturer[];
  onSuccess: (id: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manufacturerId, setManufacturerId] = useState('');
  const [instrumentType, setInstrumentType] = useState<string>('');

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const variantNames = String(formData.get('variantNames') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const result = await createInstrumentModelAction({
      manufacturerId,
      modelName: String(formData.get('modelName') ?? ''),
      instrumentType: instrumentType as (typeof INSTRUMENT_TYPES)[number],
      variantNames,
      description: String(formData.get('description') ?? '') || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'VALIDATION'
          ? 'Check the highlighted fields.'
          : 'Could not save. Try again.',
      );
      return;
    }
    toast.success('Instrument model created');
    onSuccess(result.data.id);
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
      <div className="space-y-1.5">
        <Label htmlFor="model-manufacturer">Manufacturer</Label>
        <Select value={manufacturerId} onValueChange={setManufacturerId} required>
          <SelectTrigger id="model-manufacturer" className="w-full">
            <SelectValue placeholder="Choose a manufacturer" />
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
        <Label htmlFor="modelName">Model name</Label>
        <Input id="modelName" name="modelName" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="model-type">Instrument type</Label>
        <Select value={instrumentType} onValueChange={setInstrumentType} required>
          <SelectTrigger id="model-type" className="w-full">
            <SelectValue placeholder="Choose a type" />
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
        <Label htmlFor="variantNames">Variant names (comma-separated)</Label>
        <Input id="variantNames" name="variantNames" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" />
      </div>
      <p className="text-xs text-muted-foreground">
        Metrology parameters are set on the model's own page after it's created.
      </p>
      <DialogFooter>
        <Button type="submit" disabled={pending || !manufacturerId || !instrumentType}>
          {pending ? 'Creating…' : 'Create model'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ModelsPanel({
  models,
  manufacturers,
}: {
  models: Model[];
  manufacturers: Manufacturer[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => models.filter((m) => m.modelName.toLowerCase().includes(search.toLowerCase())),
    [models, search],
  );
  const table = useTable({ features, columns, data: filtered });

  function handleSuccess(id: string) {
    setOpen(false);
    router.push(`${ROUTES.instruments}/models/${id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models…"
          className="max-w-sm"
          aria-label="Search instrument models"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              New model
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New instrument model</DialogTitle>
            </DialogHeader>
            <CreateModelForm manufacturers={manufacturers} onSuccess={handleSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No models match these filters. Clear filters or create one.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="cursor-pointer hover:bg-muted">
                {row.getAllCells().map((cell, index) => (
                  <TableCell key={cell.id}>
                    {index === 0 ? (
                      <Link
                        href={`${ROUTES.instruments}/models/${row.original.id}`}
                        className="font-medium hover:underline"
                      >
                        <table.FlexRender cell={cell} />
                      </Link>
                    ) : (
                      <table.FlexRender cell={cell} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
