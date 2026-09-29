/**
 * Serial indicator parser profiles (implementation.md §10 P10: "Web Serial
 * 'Read from instrument'... parser profiles (regex → value, unit, stable
 * flag)"). Pure, side-effect-free, and independent of `navigator.serial` so
 * they're unit-testable in Node.
 *
 * The built-in profiles are best-effort defaults for common weighing-
 * indicator output conventions, not a copied vendor spec (this environment
 * has no way to verify a specific indicator's real protocol against its
 * manual — the same "log it, don't invent silently" posture implementation.md
 * §0 asks for elsewhere, e.g. the P8 certificate template). Documented in
 * docs/API.md; a lab can also register a fully custom regex profile without
 * a code change.
 */

export interface ParsedReading {
  value: string;
  unit: string;
  stable: boolean;
}

export interface SerialParserProfile {
  id: string;
  label: string;
  description: string;
  /** Parses one line of decoded serial output; `null` if the line doesn't match. */
  parse: (line: string) => ParsedReading | null;
}

/**
 * A&D-style continuous output (A&D FX/FZ/GX indicators and many compatible
 * clones): `ST,+00123.45,g` (stable) or `US,+00123.45,g` (unstable/motion).
 * Best-effort default — see module doc.
 */
const andStyleProfile: SerialParserProfile = {
  id: 'and-style',
  label: 'A&D-style (ST/US,±value,unit)',
  description:
    'Lines like "ST,+00123.45,g" — ST/US marks stability, followed by a signed value and unit.',
  parse(line) {
    const match = /^(ST|US|OL)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([a-zA-Z]+)\s*$/.exec(line.trim());
    if (!match) return null;
    const [, flag, value, unit] = match;
    if (flag === 'OL') return null; // overload — no usable value
    return {
      value: Number(value).toString(),
      unit: (unit ?? '').toLowerCase(),
      stable: flag === 'ST',
    };
  },
};

/** A simple, explicit CSV a lab can configure an indicator (or this app's own `scripts/sim-serial.ts`) to emit: `value,unit,stable`. */
const genericCsvProfile: SerialParserProfile = {
  id: 'generic-csv',
  label: 'Generic CSV (value,unit,stable)',
  description: 'Lines like "12.345,kg,stable" or "12.345,kg,unstable".',
  parse(line) {
    const parts = line.trim().split(',');
    if (parts.length !== 3) return null;
    const [rawValue, unit, stability] = parts;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return null;
    return {
      value: value.toString(),
      unit: (unit ?? '').trim().toLowerCase(),
      stable: stability?.trim().toLowerCase() === 'stable',
    };
  },
};

export const SERIAL_PARSER_PROFILES: SerialParserProfile[] = [andStyleProfile, genericCsvProfile];

export function getSerialParserProfile(id: string): SerialParserProfile | undefined {
  return SERIAL_PARSER_PROFILES.find((p) => p.id === id);
}

/** A fully custom profile from a user-supplied regex with named groups `value`, `unit`, and optionally `stable`. */
export function buildCustomProfile(pattern: string): SerialParserProfile {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    regex = /(?!)/; // never matches — an invalid pattern parses nothing rather than throwing per-line
  }
  return {
    id: 'custom',
    label: 'Custom regex',
    description: pattern,
    parse(line) {
      const match = regex.exec(line.trim());
      if (!match?.groups?.value) return null;
      const value = Number(match.groups.value);
      if (!Number.isFinite(value)) return null;
      return {
        value: value.toString(),
        unit: (match.groups.unit ?? '').toLowerCase(),
        stable: match.groups.stable ? /^(stable|st|1|true)$/i.test(match.groups.stable) : true,
      };
    },
  };
}
