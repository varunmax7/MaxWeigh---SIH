'use client';

/**
 * Subscribes to `GET /api/v1/env/stream?lab=` (implementation.md §10 P10)
 * and derives a live/stale/offline status client-side — the server only
 * pushes a new event when the reading actually changes, so staleness has
 * to be recomputed locally against the wall clock on a timer, not just
 * whenever an event arrives.
 */
import { useEffect, useRef, useState } from 'react';
import { deriveSensorStatus, type SensorStatus } from '@/lib/sensor-status';

export interface EnvStreamReading {
  sensorId: string;
  hubCode: string;
  tempC: number;
  rhPct: number;
  pressureHpa: number;
  ts: string;
}

export interface EnvStreamState {
  reading: EnvStreamReading | null;
  status: SensorStatus;
}

const STATUS_RECHECK_MS = 5_000;

export function useEnvStream(labId: string | null): EnvStreamState {
  const [reading, setReading] = useState<EnvStreamReading | null>(null);
  const [status, setStatus] = useState<SensorStatus>('unknown');
  const readingRef = useRef<EnvStreamReading | null>(null);

  useEffect(() => {
    if (!labId) {
      setReading(null);
      setStatus('unknown');
      return;
    }

    let cancelled = false;
    const source = new EventSource(`/api/v1/env/stream?lab=${encodeURIComponent(labId)}`);

    source.addEventListener('reading', (event) => {
      if (cancelled) return;
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as EnvStreamReading;
        readingRef.current = data;
        setReading(data);
        setStatus(deriveSensorStatus(new Date(data.ts)));
      } catch {
        // Malformed event — ignore, the next tick will likely be fine.
      }
    });

    source.onerror = () => {
      // `EventSource` reconnects on its own; staleness still ticks forward
      // via the interval below, so a dropped connection surfaces as
      // "offline" after 2 minutes rather than needing its own state.
    };

    const recheck = setInterval(() => {
      if (cancelled) return;
      const last = readingRef.current;
      setStatus(last ? deriveSensorStatus(new Date(last.ts)) : 'unknown');
    }, STATUS_RECHECK_MS);

    return () => {
      cancelled = true;
      clearInterval(recheck);
      source.close();
    };
  }, [labId]);

  return { reading, status };
}
