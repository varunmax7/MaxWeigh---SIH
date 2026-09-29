'use client';

import { Cable, CircleCheck, CircleDashed, Unplug } from 'lucide-react';
import { useId, useState } from 'react';
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
import { getSerialParserProfile, SERIAL_PARSER_PROFILES } from '@/lib/serial/parsers';
import { useSerialReader } from '@/lib/serial/useSerialReader';

const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

/**
 * "Read from instrument" (implementation.md §10 P10) — connects a Web
 * Serial port (or, with no hardware available, mock mode), and inserts the
 * latest parsed reading into whichever measurement input currently has
 * focus (`insertIntoFocusedInput`). Collapsed by default so it doesn't
 * compete with the workspace's per-test forms for attention; a bench
 * officer without serial hardware never needs to open it.
 */
export function SerialReadPanel() {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState(SERIAL_PARSER_PROFILES[0]?.id ?? 'and-style');
  const [baudRate, setBaudRate] = useState(9600);
  const [mockValue, setMockValue] = useState('');
  const [mockUnit, setMockUnit] = useState('g');
  const [insertedFlash, setInsertedFlash] = useState(false);
  const reader = useSerialReader();
  const mockValueId = useId();

  const profile = getSerialParserProfile(profileId);

  function handleInsert() {
    const inserted = reader.insertLastReading();
    if (inserted) {
      setInsertedFlash(true);
      setTimeout(() => setInsertedFlash(false), 1200);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Cable className="size-4" />
        Read from instrument
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-panel)] border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Read from instrument</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      {!reader.supported ? (
        <p className="text-xs text-muted-foreground">
          Web Serial isn't supported in this browser (Chromium-based browsers only). Use mock mode
          below to try the flow without hardware.
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Parser profile</Label>
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERIAL_PARSER_PROFILES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Baud rate</Label>
          <Select value={String(baudRate)} onValueChange={(v) => setBaudRate(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BAUD_RATES.map((rate) => (
                <SelectItem key={rate} value={String(rate)}>
                  {rate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {profile ? <p className="text-xs text-muted-foreground">{profile.description}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {reader.state === 'connected' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reader.disconnect()}
          >
            <Unplug className="size-4" />
            Disconnect
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!reader.supported || reader.state === 'connecting' || !profile}
            onClick={() => profile && void reader.connect(baudRate, profile)}
          >
            <Cable className="size-4" />
            {reader.state === 'connecting' ? 'Connecting…' : 'Connect'}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={reader.startMock}>
          Mock mode
        </Button>
      </div>

      {reader.error ? <p className="text-xs text-fail">{reader.error}</p> : null}

      {reader.state === 'mock' ? (
        <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-control)] border border-dashed border-border p-2">
          <div className="space-y-1">
            <Label htmlFor={mockValueId} className="text-xs">
              Mock value
            </Label>
            <Input
              id={mockValueId}
              value={mockValue}
              onChange={(e) => setMockValue(e.target.value)}
              inputMode="decimal"
              className="tabular w-24"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit</Label>
            <Input
              value={mockUnit}
              onChange={(e) => setMockUnit(e.target.value)}
              className="w-16"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!mockValue}
            onClick={() => reader.simulateReading(mockValue, mockUnit)}
          >
            Simulate stable reading
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-muted px-3 py-2">
        <p className="tabular flex items-center gap-1.5 text-sm">
          {reader.lastReading?.stable ? (
            <CircleCheck className="size-3.5 text-pass" aria-hidden="true" />
          ) : (
            <CircleDashed className="size-3.5 text-muted-foreground" aria-hidden="true" />
          )}
          {reader.lastReading
            ? `${reader.lastReading.value} ${reader.lastReading.unit} · ${
                reader.lastReading.stable ? 'stable' : 'settling'
              }`
            : 'No reading yet'}
        </p>
        <Button
          type="button"
          size="sm"
          variant={insertedFlash ? 'default' : 'outline'}
          disabled={!reader.lastReading}
          onClick={handleInsert}
        >
          {insertedFlash ? 'Inserted' : 'Insert into focused field'}
        </Button>
      </div>
    </div>
  );
}
