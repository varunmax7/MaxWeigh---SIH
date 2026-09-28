import type { AccuracyClass, Dec, DisplayUnit, InstrumentMetrology, RangeKind } from '@tula/engine';

export interface RangeRow {
  key: string;
  max: Dec | null;
  e: Dec | null;
  d: Dec | null;
}

export interface SpecState {
  accuracyClass: AccuracyClass | '';
  kind: RangeKind | '';
  ranges: RangeRow[];
  min: Dec | null;
  maxAdditiveTare: Dec | null;
  maxSubtractiveTare: Dec | null;
  lowC: string;
  highC: string;
  isElectronic: boolean;
  hasTareDevice: boolean;
  hasZeroTracking: boolean;
  initialZeroSettingRangePct: string;
  loadReceptorKind: InstrumentMetrology['loadReceptor']['kind'] | '';
  supports: string;
  widthMm: string;
  depthMm: string;
  levelIndicator: boolean;
  tiltSusceptible: boolean;
  mainsEnabled: boolean;
  vNom: string;
  fNomHz: string;
  battery: boolean;
  dcAdapter: boolean;
  displayUnit: DisplayUnit | '';
}

/** implementation.md / R 76-1 clause 3.9.2 default when a spec doesn't state one. */
export function emptySpecState(): SpecState {
  return {
    accuracyClass: '',
    kind: '',
    ranges: [{ key: crypto.randomUUID(), max: null, e: null, d: null }],
    min: null,
    maxAdditiveTare: null,
    maxSubtractiveTare: null,
    lowC: '-10',
    highC: '40',
    isElectronic: true,
    hasTareDevice: false,
    hasZeroTracking: false,
    initialZeroSettingRangePct: '',
    loadReceptorKind: '',
    supports: '4',
    widthMm: '',
    depthMm: '',
    levelIndicator: false,
    tiltSusceptible: true,
    mainsEnabled: true,
    vNom: '',
    fNomHz: '',
    battery: false,
    dcAdapter: false,
    displayUnit: '',
  };
}

export function specStateFromMetrology(spec: InstrumentMetrology): SpecState {
  return {
    accuracyClass: spec.accuracyClass,
    kind: spec.kind,
    ranges: spec.ranges.map((r) => ({ key: crypto.randomUUID(), max: r.max, e: r.e, d: r.d })),
    min: spec.min,
    maxAdditiveTare: spec.maxAdditiveTare ?? null,
    maxSubtractiveTare: spec.maxSubtractiveTare ?? null,
    lowC: String(spec.tempRange.lowC),
    highC: String(spec.tempRange.highC),
    isElectronic: spec.isElectronic,
    hasTareDevice: spec.hasTareDevice,
    hasZeroTracking: spec.hasZeroTracking,
    initialZeroSettingRangePct:
      spec.initialZeroSettingRangePct === undefined ? '' : String(spec.initialZeroSettingRangePct),
    loadReceptorKind: spec.loadReceptor.kind,
    supports: String(spec.loadReceptor.supports),
    widthMm: spec.loadReceptor.widthMm === undefined ? '' : String(spec.loadReceptor.widthMm),
    depthMm: spec.loadReceptor.depthMm === undefined ? '' : String(spec.loadReceptor.depthMm),
    levelIndicator: spec.levelIndicator,
    tiltSusceptible: spec.tiltSusceptible,
    mainsEnabled: Boolean(spec.powerSupply.mains),
    vNom: spec.powerSupply.mains ? String(spec.powerSupply.mains.vNom) : '',
    fNomHz: spec.powerSupply.mains ? String(spec.powerSupply.mains.fNomHz) : '',
    battery: spec.powerSupply.battery ?? false,
    dcAdapter: spec.powerSupply.dcAdapter ?? false,
    displayUnit: spec.displayUnit,
  };
}

/** Returns null while required fields are still incomplete — no partial spec is ever submitted or classified. */
export function toInstrumentMetrology(s: SpecState): InstrumentMetrology | null {
  if (!s.accuracyClass || !s.kind || !s.displayUnit || !s.loadReceptorKind) return null;
  if (!s.min) return null;
  const lowC = Number(s.lowC);
  const highC = Number(s.highC);
  const supports = Number(s.supports);
  if (!Number.isFinite(lowC) || !Number.isFinite(highC) || !Number.isFinite(supports)) return null;
  if (!s.mainsEnabled && !s.battery && !s.dcAdapter) return null;
  if (s.mainsEnabled && (!s.vNom || !s.fNomHz)) return null;

  const ranges = s.ranges
    .filter((r) => r.max && r.e && r.d)
    .map((r) => ({ max: r.max as Dec, e: r.e as Dec, d: r.d as Dec }));
  if (ranges.length === 0) return null;

  return {
    accuracyClass: s.accuracyClass,
    kind: s.kind,
    ranges,
    min: s.min,
    maxAdditiveTare: s.maxAdditiveTare ?? undefined,
    maxSubtractiveTare: s.maxSubtractiveTare ?? undefined,
    tempRange: { lowC, highC },
    isElectronic: s.isElectronic,
    hasTareDevice: s.hasTareDevice,
    hasZeroTracking: s.hasZeroTracking,
    initialZeroSettingRangePct: s.initialZeroSettingRangePct
      ? Number(s.initialZeroSettingRangePct)
      : undefined,
    loadReceptor: {
      kind: s.loadReceptorKind,
      supports,
      widthMm: s.widthMm ? Number(s.widthMm) : undefined,
      depthMm: s.depthMm ? Number(s.depthMm) : undefined,
    },
    levelIndicator: s.levelIndicator,
    tiltSusceptible: s.tiltSusceptible,
    powerSupply: {
      mains: s.mainsEnabled ? { vNom: Number(s.vNom), fNomHz: Number(s.fNomHz) } : undefined,
      battery: s.battery || undefined,
      dcAdapter: s.dcAdapter || undefined,
    },
    displayUnit: s.displayUnit,
  };
}
