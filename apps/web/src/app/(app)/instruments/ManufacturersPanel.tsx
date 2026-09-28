'use client';

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createManufacturerAction, updateManufacturerAction } from '@/server/actions/masterdata';
import type { listManufacturers } from '@/server/queries/masterdata';

type Manufacturer = Awaited<ReturnType<typeof listManufacturers>>[number];

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const helper = createColumnHelper<typeof features, Manufacturer>();
const columns = helper.columns([
  helper.accessor('name', { header: 'Name' }),
  helper.accessor('country', { header: 'Country' }),
  helper.accessor('contactName', { header: 'Contact' }),
  helper.accessor('email', { header: 'Email' }),
  helper.accessor('phone', { header: 'Phone' }),
]);

function optionalField(formData: FormData, name: string): string | undefined {
  return String(formData.get(name) ?? '') || undefined;
}

function ManufacturerForm({
  manufacturer,
  onSuccess,
}: {
  manufacturer?: Manufacturer;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const input = {
      name: String(formData.get('name') ?? ''),
      address: optionalField(formData, 'address'),
      country: optionalField(formData, 'country'),
      contactName: optionalField(formData, 'contactName'),
      email: optionalField(formData, 'email'),
      phone: optionalField(formData, 'phone'),
      website: optionalField(formData, 'website'),
    };

    const result = manufacturer
      ? await updateManufacturerAction({ ...input, id: manufacturer.id })
      : await createManufacturerAction(input);

    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'VALIDATION'
          ? 'Check the highlighted fields.'
          : 'Could not save. Try again.',
      );
      return;
    }
    toast.success(manufacturer ? 'Manufacturer updated' : 'Manufacturer created');
    onSuccess();
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
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={manufacturer?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" defaultValue={manufacturer?.country ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Contact name</Label>
          <Input
            id="contactName"
            name="contactName"
            defaultValue={manufacturer?.contactName ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={manufacturer?.email ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={manufacturer?.phone ?? ''} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={manufacturer?.address ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" defaultValue={manufacturer?.website ?? ''} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : manufacturer ? 'Save changes' : 'Create manufacturer'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ManufacturersPanel({ manufacturers }: { manufacturers: Manufacturer[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => manufacturers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [manufacturers, search],
  );
  const table = useTable({ features, columns, data: filtered });

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search manufacturers…"
          className="max-w-sm"
          aria-label="Search manufacturers"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              New manufacturer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New manufacturer</DialogTitle>
            </DialogHeader>
            <ManufacturerForm onSuccess={handleSuccess} />
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
                No manufacturers match these filters. Clear filters or create one.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
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
