'use client';

import { useState } from 'react';
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
import { createApplicantAction, createManufacturerAction } from '@/server/actions/masterdata';
import type { listApplicants, listManufacturers } from '@/server/queries/masterdata';

type Manufacturer = Awaited<ReturnType<typeof listManufacturers>>[number];
type Applicant = Awaited<ReturnType<typeof listApplicants>>[number];

function QuickCreateManufacturer({ onCreated }: { onCreated: (m: Manufacturer) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    setPending(true);
    const result = await createManufacturerAction({ name });
    setPending(false);
    if (!result.ok) {
      toast.error('Could not create manufacturer.');
      return;
    }
    onCreated({
      id: result.data.id,
      name,
      address: null,
      country: null,
      contactName: null,
      email: null,
      phone: null,
      website: null,
      createdAt: new Date(),
    });
    setName('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          New manufacturer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New manufacturer</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="quick-mfr-name">Name</Label>
          <Input id="quick-mfr-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={pending || !name.trim()}>
            {pending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickCreateApplicant({ onCreated }: { onCreated: (a: Applicant) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    setPending(true);
    const result = await createApplicantAction({ name });
    setPending(false);
    if (!result.ok) {
      toast.error('Could not create applicant.');
      return;
    }
    onCreated({
      id: result.data.id,
      name,
      address: null,
      contactName: null,
      email: null,
      phone: null,
      manufacturerId: null,
      manufacturerName: null,
      createdAt: new Date(),
    });
    setName('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          New applicant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New applicant</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="quick-app-name">Name</Label>
          <Input id="quick-app-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={pending || !name.trim()}>
            {pending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Step 1 (implementation.md §7.5): "Applicant & manufacturer (search-or-create combobox)." */
export function Step1ApplicantManufacturer({
  manufacturers,
  applicants,
  manufacturerId,
  applicantId,
  onManufacturerChange,
  onApplicantChange,
  onManufacturerCreated,
  onApplicantCreated,
}: {
  manufacturers: Manufacturer[];
  applicants: Applicant[];
  manufacturerId: string;
  applicantId: string;
  onManufacturerChange: (id: string) => void;
  onApplicantChange: (id: string) => void;
  onManufacturerCreated: (m: Manufacturer) => void;
  onApplicantCreated: (a: Applicant) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="step1-manufacturer">Manufacturer</Label>
          <QuickCreateManufacturer onCreated={onManufacturerCreated} />
        </div>
        <Select value={manufacturerId} onValueChange={onManufacturerChange}>
          <SelectTrigger id="step1-manufacturer" className="w-full">
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
        <div className="flex items-center justify-between">
          <Label htmlFor="step1-applicant">Applicant</Label>
          <QuickCreateApplicant onCreated={onApplicantCreated} />
        </div>
        <Select value={applicantId} onValueChange={onApplicantChange}>
          <SelectTrigger id="step1-applicant" className="w-full">
            <SelectValue placeholder="Choose an applicant" />
          </SelectTrigger>
          <SelectContent>
            {applicants.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
