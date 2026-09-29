/**
 * A thin, line-buffered wrapper around the Web Serial API (implementation.md
 * §10 P10: "Web Serial 'Read from instrument' (Chromium): connect, parser
 * profiles..., writes into the active cell; mock mode"). Browser-only —
 * `isSerialSupported()` feature-detects `navigator.serial` so the caller can
 * show "not supported in this browser" instead of throwing.
 */
// Aliased (`@/...`), not relative (`./...`) imports — a reproducible
// Turbopack production-build bug in this Next 16.3.6 canary (see
// docs/QUESTIONS.md) fails to resolve a client `.ts` module's *relative*
// imports once it references more than one distinct relative file path
// (fine under `next dev` and `tsc`; `@/`-aliased imports are unaffected).
import { insertIntoFocusedInput } from '@/lib/serial/insert-into-focused-input';
import type { ParsedReading, SerialParserProfile } from '@/lib/serial/parsers';

export type { ParsedReading, SerialParserProfile };
// Re-exported from here (not imported directly by `useSerialReader.ts`) so
// that file only needs one import specifier too.
export { insertIntoFocusedInput };

export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && Boolean(navigator.serial);
}

export interface SerialConnectionOptions {
  baudRate: number;
  profile: SerialParserProfile;
  onReading: (reading: ParsedReading) => void;
  onDisconnect: () => void;
}

/** One open serial port, decoding to text and splitting on newlines before handing each line to the parser profile. */
export class SerialConnection {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private closed = false;

  static async connect(options: SerialConnectionOptions): Promise<SerialConnection> {
    if (!isSerialSupported()) {
      throw new Error('Web Serial is not supported in this browser.');
    }
    const conn = new SerialConnection();
    await conn.open(options);
    return conn;
  }

  private async open({ baudRate, profile, onReading, onDisconnect }: SerialConnectionOptions) {
    const port = await navigator.serial?.requestPort();
    if (!port) throw new Error('No serial port selected.');
    await port.open({ baudRate });
    this.port = port;

    if (!port.readable) throw new Error('Serial port has no readable stream.');
    // `TextDecoderStream`'s DOM typing declares its writable side as
    // `WritableStream<BufferSource>`, which TS's structural check on
    // `pipeThrough` won't accept from a plain `ReadableStream<Uint8Array>`
    // (a known lib.dom.d.ts variance quirk, not a real runtime mismatch —
    // a `Uint8Array` is a `BufferSource`).
    const decoder = new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>;
    const lineStream = port.readable.pipeThrough(decoder).pipeThrough(lineSplitter());
    this.reader = lineStream.getReader();

    void this.pump(profile, onReading, onDisconnect);
  }

  private async pump(
    profile: SerialParserProfile,
    onReading: (reading: ParsedReading) => void,
    onDisconnect: () => void,
  ) {
    try {
      while (!this.closed && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value == null) continue;
        const parsed = profile.parse(value);
        if (parsed) onReading(parsed);
      }
    } catch {
      // The port was unplugged or closed out from under the reader loop.
    } finally {
      if (!this.closed) onDisconnect();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    try {
      await this.reader?.cancel();
    } catch {
      // already gone
    }
    this.reader?.releaseLock();
    try {
      await this.port?.close();
    } catch {
      // already gone
    }
  }
}

/** Splits a decoded text stream into lines, dropping the trailing newline of each. */
function lineSplitter(): TransformStream<string, string> {
  let buffer = '';
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.length > 0) controller.enqueue(line);
      }
    },
    flush(controller) {
      if (buffer.length > 0) controller.enqueue(buffer);
    },
  });
}
