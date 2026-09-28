'use client';

import { AlertTriangle, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { registerEnvSensorAction } from '@/server/actions/masterdata';
import type { listEnvSensors } from '@/server/queries/masterdata';

type Sensor = Awaited<ReturnType<typeof listEnvSensors>>[number];

function RegisterSensorForm({
  labId,
  onIssued,
}: {
  labId: string;
  onIssued: (key: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await registerEnvSensorAction({
      labId,
      hubCode: String(formData.get('hubCode') ?? ''),
      calibratedOn: String(formData.get('calibratedOn') ?? '') || undefined,
      dueOn: String(formData.get('dueOn') ?? '') || undefined,
    });
    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'VALIDATION'
          ? 'Check the highlighted fields.'
          : 'Could not register. Try again.',
      );
      return;
    }
    onIssued(result.data.deviceKey);
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
        <Label htmlFor="hubCode">Hub code</Label>
        <Input id="hubCode" name="hubCode" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sensor-calibratedOn">Calibrated on</Label>
          <Input id="sensor-calibratedOn" name="calibratedOn" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sensor-dueOn">Due on</Label>
          <Input id="sensor-dueOn" name="dueOn" type="date" />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Registering…' : 'Register sensor'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SensorsTable({ sensors }: { sensors: Sensor[] }) {
  if (sensors.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No environment sensors yet.</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hub code</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sensors.map((sensor) => (
          <TableRow key={sensor.id}>
            <TableCell className="tabular font-medium">{sensor.hubCode}</TableCell>
            <TableCell className="tabular">{sensor.dueOn ?? '—'}</TableCell>
            <TableCell>
              {sensor.expired ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  Calibration expired
                </Badge>
              ) : (
                <Badge variant="outline">{sensor.status}</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function EnvSensorsPanel({ sensors, labId }: { sensors: Sensor[]; labId: string }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const deviceKeyDialogId = useId();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Environment sensors</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Register sensor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register environment sensor</DialogTitle>
            </DialogHeader>
            <RegisterSensorForm
              labId={labId}
              onIssued={(key) => {
                setDialogOpen(false);
                setIssuedKey(key);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <SensorsTable sensors={sensors} />

      <Dialog
        open={issuedKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIssuedKey(null);
            router.refresh();
          }
        }}
      >
        <DialogContent aria-describedby={deviceKeyDialogId}>
          <DialogHeader>
            <DialogTitle>Sensor registered</DialogTitle>
          </DialogHeader>
          <p id={deviceKeyDialogId} className="text-sm text-muted-foreground">
            Copy this device key now — it is shown only once and cannot be retrieved again.
          </p>
          <p className="tabular break-all rounded-[var(--radius-control)] bg-muted px-3 py-2 text-sm">
            {issuedKey}
          </p>
          <DialogFooter>
            <Button
              onClick={() => {
                setIssuedKey(null);
                router.refresh();
              }}
            >
              I've saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
