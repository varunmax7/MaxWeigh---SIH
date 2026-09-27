/**
 * Core types for the OIML R 76 engine (implementation.md §4.2).
 *
 * `Dec` is a decimal string at every module boundary (JSON, DB, wire); inside
 * the engine every mass and error is a `Decimal` (see decimal.ts). Never do
 * arithmetic on a `Dec` directly — parse it with `D()` first.
 */
import type { Rulepack } from './rulepack.js';
import type { DisplayUnit } from './units.js';

export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII';
export type RangeKind = 'single' | 'multi_range' | 'multi_interval';

/** A decimal string at engine boundaries; parse with `D()`, serialize with `toDec()`. */
export type Dec = string;

/** One weighing range or partial interval. `ranges[i].max` is `Max_i`; ranges are ascending. */
export interface WeighingRange {
  max: Dec;
  e: Dec;
  d: Dec;
}

export interface InstrumentMetrology {
  accuracyClass: AccuracyClass;
  kind: RangeKind;
  /** Length 1 for a single-interval instrument. */
  ranges: WeighingRange[];
  min: Dec;
  /** T+ */
  maxAdditiveTare?: Dec;
  /** T− */
  maxSubtractiveTare?: Dec;
  /** Default −10 / +40 °C (R 76-1 clause 3.9.2) when not otherwise stated. */
  tempRange: { lowC: number; highC: number };
  isElectronic: boolean;
  hasTareDevice: boolean;
  hasZeroTracking: boolean;
  /** Percent of Max; drives the `CLS_ZERO_RANGE_SUPPL` info issue at > 20 %. */
  initialZeroSettingRangePct?: number;
  loadReceptor: {
    kind: 'platform' | 'pan' | 'hook' | 'hopper' | 'vehicle' | 'other';
    supports: number;
    widthMm?: number;
    depthMm?: number;
  };
  levelIndicator: boolean;
  /** False for fixed installations (exempts TILTING). */
  tiltSusceptible: boolean;
  powerSupply: { mains?: { vNom: number; fNomHz: number }; battery?: boolean; dcAdapter?: boolean };
  displayUnit: DisplayUnit;
}

/** `error` blocks a test from ever reaching PASS; `warning` and `info` do not. */
export type Severity = 'error' | 'warning' | 'info';

/**
 * A validation or evaluation finding. `code` + `params` render the message in
 * the UI (i18n-ready) — never bake user-facing text in here (§11: UI rules).
 */
export interface Issue {
  code: string;
  severity: Severity;
  clause?: string;
  path?: string;
  params: Record<string, string>;
}

/** One line of the "show calculation" trail, and a row in the methodology annex. */
export interface CalcStep {
  label: string;
  formula: string;
  substituted: string;
  result: string;
  clause?: string;
}

export type Verdict = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_APPLICABLE';

export interface RowResult {
  rowId: string;
  P?: Dec;
  E?: Dec;
  Ec?: Dec;
  EcInE?: Dec;
  mpe?: Dec;
  mpeInE?: Dec;
  verdict: Verdict;
  issues: Issue[];
}

export interface TestResult {
  verdict: Verdict;
  rows: RowResult[];
  /** e.g. maxAbsEc, maxAbsEcInE, spread — surfaced in the report's summary table. */
  summary: Record<string, Dec | string>;
  issues: Issue[];
  /** Powers "Show calculation" in the UI and the report's methodology annex. */
  steps: CalcStep[];
  engineVersion: string;
  rulepack: { id: string; version: string };
}

export interface EvaluatorContext<P> {
  instrument: InstrumentMetrology;
  rulepack: Rulepack;
  params: P;
}

export type Evaluator<O, P> = (obs: O, ctx: EvaluatorContext<P>) => TestResult;
