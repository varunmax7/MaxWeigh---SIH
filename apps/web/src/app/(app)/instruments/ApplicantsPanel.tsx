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
import { createApplicantAction, updateApplicantAction } from '@/server/actions/masterdata';
import type { listApplicants, listManufacturers } from '@/server/queries/masterdata';

type Applicant = Awaited<ReturnType<typeof listApplicants>>[number];
type Manufacturer = Awaited<ReturnType<typeof listManufacturers>>[number];

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
const helper = createColumnHelper<typeof features, Applicant>();
const columns = helper.columns([
  helper.accessor('name', { header: 'Name' }),
  helper.accessor('manufacturerName', { header: 'Manufacturer' }),
  helper.accessor('contactName', { header: 'Contact' }),
  helper.accessor('email', { header: 'Email' }),
  helper.accessor('phone', { header: 'Phone' }),
]);

function ApplicantForm({
  applicant,
  manufacturers,
  onSuccess,
}: {
  applicant?: Applicant;
  manufacturers: Manufacturer[];
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manufacturerId, setManufacturerId] = useState(applicant?.manufacturerId ?? '');

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const input = {
      name: String(formData.get('name') ?? ''),
      address: String(formData.get('address') ?? '') || undefined,
      contactName: String(formData.get('contactName') ?? '') || undefined,
      email: String(formData.get('email') ?? '') || undefined,
      phone: String(formData.get('phone') ?? '') || undefined,
      manufacturerId: manufacturerId || undefined,
    };

    const result = applicant
      ? await updateApplicantAction({ ...input, id: applicant.id })
      : await createApplicantAction(input);

    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'VALIDATION'
          ? 'Check the highlighted fields.'
          : 'Could not save. Try again.',
      );
      return;
    }
    toast.success(applicant ? 'Applicant updated' : 'Applicant created');
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
        <Label htmlFor="applicant-name">Name</Label>
        <Input id="applicant-name" name="name" defaultValue={applicant?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="applicant-manufacturer">Manufacturer (if different from applicant)</Label>
        <Select value={manufacturerId} onValueChange={setManufacturerId}>
          <SelectTrigger id="applicant-manufacturer" className="w-full">
            <SelectValue placeholder="None" />
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="applicant-contactName">Contact name</Label>
          <Input
            id="applicant-contactName"
            name="contactName"
            defaultValue={applicant?.contactName ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="applicant-email">Email</Label>
          <Input
            id="applicant-email"
            name="email"
            type="email"
            defaultValue={applicant?.email ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="applicant-phone">Phone</Label>
          <Input id="applicant-phone" name="phone" defaultValue={applicant?.phone ?? ''} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="applicant-address">Address</Label>
        <Input id="applicant-address" name="address" defaultValue={applicant?.address ?? ''} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : applicant ? 'Save changes' : 'Create applicant'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ApplicantsPanel({
  applicants,
  manufacturers,
}: {
  applicants: Applicant[];
  manufacturers: Manufacturer[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => applicants.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [applicants, search],
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
          placeholder="Search applicants…"
          className="max-w-sm"
          aria-label="Search applicants"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              New applicant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New applicant</DialogTitle>
            </DialogHeader>
            <ApplicantForm manufacturers={manufacturers} onSuccess={handleSuccess} />
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
                No applicants match these filters. Clear filters or create one.
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
