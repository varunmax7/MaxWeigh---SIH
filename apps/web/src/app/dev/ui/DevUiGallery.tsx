'use client';

import { Info, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ClassBadge,
  ErrorInE,
  MassValue,
  SealMark,
  SpecLine,
  StatusChip,
  type StatusChipValue,
  VerdictChip,
  type VerdictChipValue,
} from '@/components/metrology';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Stepper } from '@/components/ui/stepper';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const VERDICTS: VerdictChipValue[] = [
  'PASS',
  'FAIL',
  'INCOMPLETE',
  'NOT_APPLICABLE',
  'CONFORMS',
  'DOES_NOT_CONFORM',
];

const STATUSES: StatusChipValue[] = [
  'DRAFT',
  'PLANNED',
  'IN_TESTING',
  'PENDING_T1',
  'PENDING_T2',
  'PENDING_T3',
  'ISSUED',
  'RETURNED',
  'REVOKED',
  'AMENDING',
  'CANCELLED',
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'REOPENED',
];

const STANDARDS = ['WS-F2-09', 'WS-F2-14', 'WS-M1-02', 'WS-E2-01'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border pb-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`size-12 rounded-[var(--radius-control)] border border-border ${className}`}
      />
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

export function DevUiGallery() {
  const [comboValue, setComboValue] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Component gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every component in every state (implementation.md §7.6). Dev only.
        </p>
      </div>

      <Section title="Colour tokens">
        <Swatch name="primary" className="bg-primary" />
        <Swatch name="secondary" className="bg-secondary" />
        <Swatch name="muted" className="bg-muted" />
        <Swatch name="pass" className="bg-pass-bg" />
        <Swatch name="fail" className="bg-fail-bg" />
        <Swatch name="pending" className="bg-pending-bg" />
        <Swatch name="active" className="bg-active-bg" />
        <Swatch name="seal (brass)" className="bg-seal-bg" />
      </Section>

      <Section title="Typography">
        <div className="space-y-2">
          <p className="text-[30px] leading-[38px]">Dashboard figures 30/38</p>
          <p className="text-2xl">Page title 24/32</p>
          <p className="text-xl">Section 20/28</p>
          <p className="text-base">Lead 16/24</p>
          <p className="text-sm">Body 14/20</p>
          <p className="text-[13px] leading-[18px]">Dense table 13/18</p>
          <p className="text-xs">Caption 12/16</p>
          <p className="tabular text-sm">
            Tabular mono — 10.000 kg, EV-BLR-2026-0142, clause 3.5.1
          </p>
          <p className="font-devanagari text-base">Devanagari — तुला भार यंत्र सत्यापन</p>
        </div>
      </Section>

      <Section title="Button">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="icon" aria-label="Add">
          <Plus className="size-4" />
        </Button>
      </Section>

      <Section title="Input, label, select, combobox">
        <div className="w-64 space-y-1.5">
          <Label htmlFor="gallery-input">Reference number</Label>
          <Input id="gallery-input" placeholder="EV-BLR-2026-0142" />
        </div>
        <div className="w-64 space-y-1.5">
          <Label htmlFor="gallery-input-disabled">Disabled</Label>
          <Input id="gallery-input-disabled" disabled placeholder="Disabled" />
        </div>
        <div className="w-64 space-y-1.5">
          <Label htmlFor="gallery-input-invalid">Invalid</Label>
          <Input id="gallery-input-invalid" aria-invalid defaultValue="10 002 g" />
          <p className="text-xs text-fail">
            Indication must be a multiple of d (5 g). 10 002 g is not.
          </p>
        </div>
        <div className="w-56 space-y-1.5">
          <Label htmlFor="gallery-select">Standards</Label>
          <Select>
            <SelectTrigger id="gallery-select" className="w-full">
              <SelectValue placeholder="Choose a weight set" />
            </SelectTrigger>
            <SelectContent>
              {STANDARDS.map((standard) => (
                <SelectItem key={standard} value={standard}>
                  {standard}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1.5">
          <Label htmlFor="gallery-combobox">Search-or-create</Label>
          <Combobox items={STANDARDS} value={comboValue} onValueChange={setComboValue}>
            <ComboboxInput id="gallery-combobox" placeholder="Select a standard" />
            <ComboboxContent>
              <ComboboxEmpty>No results found.</ComboboxEmpty>
              <ComboboxList>
                {(item) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </Section>

      <Section title="Badge">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="overview" className="w-full max-w-md">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">
            Overview content.
          </TabsContent>
          <TabsContent value="execution" className="text-sm text-muted-foreground">
            Execution content.
          </TabsContent>
          <TabsContent value="history" className="text-sm text-muted-foreground">
            History content.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref no.</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verdict</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="tabular">EV-BLR-2026-0142</TableCell>
              <TableCell>Apex AP-30</TableCell>
              <TableCell>
                <StatusChip status="IN_TESTING" />
              </TableCell>
              <TableCell>
                <VerdictChip verdict="INCOMPLETE" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="tabular">EV-BLR-2026-0098</TableCell>
              <TableCell>Precisa PB-15</TableCell>
              <TableCell>
                <StatusChip status="ISSUED" />
              </TableCell>
              <TableCell>
                <VerdictChip verdict="CONFORMS" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="Skeleton">
        <div className="w-64 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-24 w-full rounded-[var(--radius-panel)]" />
        </div>
      </Section>

      <Section title="Stepper">
        <Stepper
          className="w-72"
          currentStep={1}
          steps={[
            { label: 'Applicant & manufacturer', description: 'Search or create' },
            { label: 'Instrument', description: 'Model, serials' },
            { label: 'Metrology parameters', description: 'Live classification' },
            { label: 'Test plan' },
            { label: 'Assignment' },
          ]}
        />
      </Section>

      <Section title="Dialog, sheet, popover, tooltip, dropdown, command">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return with comments</DialogTitle>
              <DialogDescription>This requires a typed reason.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Reason" aria-label="Reason" />
            <DialogFooter>
              <Button>Return</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Inspector</SheetTitle>
              <SheetDescription>Collapses into a drawer at 1024–1439px.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Show calculation</Button>
          </PopoverTrigger>
          <PopoverContent className="text-sm">
            Ec = E − E0 = (+3.0) − (−0.5) = +3.5 g; |3.5| &gt; 2.5 g (MPE at 500 e, class III,
            clause 3.5.1) → Fail
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Guidance">
              <Info className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clause 3.5.1</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Row actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Open</DropdownMenuItem>
            <DropdownMenuItem>Download PDF</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Revoke</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          onClick={() => toast.success('Test marked complete', { description: 'Saved 12:04:31' })}
        >
          Trigger toast
        </Button>

        <p className="w-full text-xs text-muted-foreground">
          Command palette: press ⌘K on any signed-in page (it lives in the app shell, not this
          gallery).
        </p>
      </Section>

      <Section title="Metrology — VerdictChip">
        {VERDICTS.map((verdict) => (
          <VerdictChip key={verdict} verdict={verdict} />
        ))}
      </Section>

      <Section title="Metrology — StatusChip">
        {STATUSES.map((status) => (
          <StatusChip key={status} status={status} />
        ))}
      </Section>

      <Section title="Metrology — ClassBadge, SealMark">
        <ClassBadge value="III" />
        <ClassBadge value="F2" />
        <ClassBadge value="E1" />
        <SealMark label="Sealed" />
        <SealMark label="Signed" />
        <SealMark label="Valid" />
      </Section>

      <Section title="Metrology — MassValue, ErrorInE">
        <MassValue grams="30000" unit="kg" decimalPlaces={3} />
        <MassValue grams="100" unit="g" decimalPlaces={0} />
        <ErrorInE value="0.70" />
        <ErrorInE value="-1.50" />
      </Section>

      <Section title="Metrology — SpecLine">
        <SpecLine
          accuracyClass="III"
          max="30000"
          maxUnit="kg"
          min="100"
          e="5"
          d="5"
          smallUnit="g"
          n={6000}
        />
      </Section>
    </main>
  );
}
