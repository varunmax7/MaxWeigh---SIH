'use client';

/**
 * Orchestrates one serial connection (or its mock-mode stand-in) for the
 * workspace's "Read from instrument" panel (implementation.md §10 P10).
 *
 * Imports everything local — values and types alike — through
 * `./serial-connection.js` alone, never `./parsers.js` or
 * `./insert-into-focused-input.js` directly; see the comment in
 * `serial-connection.ts` for why a second distinct relative target here
 * breaks the production build.
 */
import { useCallback, useRef, useState } from 'react';
import {
  insertIntoFocusedInput,
  isSerialSupported,
  type ParsedReading,
  SerialConnection,
  type SerialParserProfile,
} from '@/lib/serial/serial-connection';

export type SerialConnectionState = 'disconnected' | 'connecting' | 'connected' | 'mock';

export function useSerialReader() {
  const [state, setState] = useState<SerialConnectionState>('disconnected');
  const [lastReading, setLastReading] = useState<ParsedReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<SerialConnection | null>(null);

  const handleReading = useCallback((reading: ParsedReading) => {
    setLastReading(reading);
  }, []);

  const connect = useCallback(
    async (baudRate: number, profile: SerialParserProfile) => {
      setError(null);
      setState('connecting');
      try {
        const conn = await SerialConnection.connect({
          baudRate,
          profile,
          onReading: handleReading,
          onDisconnect: () => {
            connectionRef.current = null;
            setState('disconnected');
          },
        });
        connectionRef.current = conn;
        setState('connected');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open the serial port.');
        setState('disconnected');
      }
    },
    [handleReading],
  );

  const startMock = useCallback(() => {
    setError(null);
    setState('mock');
  }, []);

  const disconnect = useCallback(async () => {
    await connectionRef.current?.close();
    connectionRef.current = null;
    setState('disconnected');
  }, []);

  /** Mock mode's stand-in for an instrument's send button. */
  const simulateReading = useCallback((value: string, unit: string) => {
    const reading: ParsedReading = { value, unit, stable: true };
    setLastReading(reading);
  }, []);

  /** Writes the last reading's value into whichever `data-serial-target` input currently has focus. */
  const insertLastReading = useCallback((): boolean => {
    if (!lastReading) return false;
    return insertIntoFocusedInput(lastReading.value);
  }, [lastReading]);

  return {
    state,
    lastReading,
    error,
    supported: isSerialSupported(),
    connect,
    disconnect,
    startMock,
    simulateReading,
    insertLastReading,
  };
}
