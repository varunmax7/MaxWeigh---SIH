import type { TestResult } from '@tula/engine';
import { describe, expect, it } from 'vitest';
import { diffReportModels, summarizeChanges } from './diff.js';
import {
  type BuildReportModelInput,
  buildReportModel,
  modelSha256,
  nextVersion,
  type ReportModelTest,
} from './model.js';

function passingResult(verdict: TestResult['verdict'] = 'PASS'): TestResult {
  return {
    verdict,
    rows: [],
    summary: { maxAbsEc: '1.5' },
    issues: [],
    steps: [
      {
        label: 'Corrected error',
        formula: 'Ec = E − E0',
        substituted: 'Ec = 1.0 − (−0.5) = 1.5',
        result: '1.5',
        clause: '4.5',
      },
    ],
    engineVersion: '0.1.0',
    rulepack: { id: 'oiml-r76-1-2006', version: '1.0.0' },
  };
}

function test(overrides: Partial<ReportModelTest> = {}): ReportModelTest {
  return {
    testCode: 'WEIGHING',
    rangeIndex: 0,
    sequence: 10,
    clause: '3.5.1',
    title: 'Weighing test',
    applicability: 'APPLICABLE',
    naReason: null,
    verdict: 'PASS',
    params: null,
    observations: { ascending: [{ L: '10000', I: '10000' }] },
    result: passingResult(),
    envStart: null,
    envEnd: null,
    completedAt: '2026-09-29T06:00:00.000Z',
    completedByName: 'Seed Testing Officer',
    standards: [
      { setCode: 'WS-F2-09', oimlClass: 'F2', certificateNo: 'C-1', dueOn: '2027-03-01' },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<BuildReportModelInput> = {}): BuildReportModelInput {
  return {
    reportNo: 'TR-RRSL-BLR-2026-0001',
    version: '1.0',
    lab: {
      code: 'RRSL-BLR',
      name: 'RRSL Bengaluru',
      address: null,
      state: 'Karnataka',
      accreditationNo: null,
    },
    evaluation: { refNo: 'EV-RRSL-BLR-2026-0142', sampleSerials: ['SN-1'], priority: 'normal' },
    applicant: { name: 'Apex Scales', address: null, country: 'IN' },
    manufacturer: { name: 'Apex Manufacturing', address: null, country: 'IN' },
    instrument: { modelName: 'AP-30', modelCode: 'AP30', spec: { accuracyClass: 'III' } },
    provenance: {
      rulepackId: 'oiml-r76-1-2006',
      rulepackVersion: '1.0.0',
      engineVersion: '0.1.0',
    },
    tests: [test()],
    attachments: [],
    ...overrides,
  };
}

describe('buildReportModel', () => {
  it('rolls the tests up through the engine and carries its provenance', () => {
    const model = buildReportModel(input());

    expect(model.modelVersion).toBe(1);
    expect(model.summary.overallVerdict).toBe('CONFORMS');
    expect(model.summary.rows).toEqual([{ code: 'WEIGHING', verdict: 'PASS' }]);
    expect(model.provenance).toEqual({
      rulepackId: 'oiml-r76-1-2006',
      rulepackVersion: '1.0.0',
      engineVersion: '0.1.0',
    });
  });

  it('treats an applicable test with no engine result as INCOMPLETE, never CONFORMS', () => {
    const model = buildReportModel(
      input({ tests: [test(), test({ testCode: 'CREEP', sequence: 20, result: null })] }),
    );
    expect(model.summary.overallVerdict).toBe('INCOMPLETE');
  });

  it('excludes NOT_APPLICABLE tests from the pass/fail roll-up but keeps them in the summary', () => {
    const model = buildReportModel(
      input({
        tests: [
          test(),
          test({
            testCode: 'ZERO_TRACKING',
            sequence: 20,
            applicability: 'NOT_APPLICABLE',
            naReason: 'No zero-tracking device',
            verdict: null,
            result: null,
          }),
        ],
      }),
    );
    expect(model.summary.overallVerdict).toBe('CONFORMS');
    expect(model.summary.rows).toHaveLength(2);
  });

  it('is a FAIL overall as soon as one applicable test fails', () => {
    const model = buildReportModel(
      input({ tests: [test({ verdict: 'FAIL', result: passingResult('FAIL') })] }),
    );
    expect(model.summary.overallVerdict).toBe('DOES_NOT_CONFORM');
  });

  it('orders tests by planned sequence, not by the order they were passed in', () => {
    const model = buildReportModel(
      input({
        tests: [
          test({ testCode: 'CREEP', sequence: 30 }),
          test({ testCode: 'ZERO_ACC', sequence: 5 }),
        ],
      }),
    );
    expect(model.tests.map((t) => t.testCode)).toEqual(['ZERO_ACC', 'CREEP']);
  });

  it('builds the methodology annex from the engine CalcSteps only', () => {
    const model = buildReportModel(
      input({ tests: [test(), test({ testCode: 'CREEP', sequence: 20, result: null })] }),
    );
    expect(model.methodology).toHaveLength(1);
    expect(model.methodology[0]?.steps[0]?.formula).toBe('Ec = E − E0');
  });
});

describe('modelSha256', () => {
  it('is stable across rebuilds of the same data — an approval binds to it', () => {
    expect(modelSha256(buildReportModel(input()))).toBe(modelSha256(buildReportModel(input())));
  });

  it('does not depend on key insertion order', () => {
    const a = buildReportModel(input());
    const b = buildReportModel(
      input({
        instrument: { spec: { accuracyClass: 'III' }, modelCode: 'AP30', modelName: 'AP-30' },
      }),
    );
    expect(modelSha256(a)).toBe(modelSha256(b));
  });

  it('changes when an observation changes — this is what invalidates a pending approval', () => {
    const before = buildReportModel(input());
    const after = buildReportModel(
      input({ tests: [test({ observations: { ascending: [{ L: '10000', I: '10005' }] } })] }),
    );
    expect(modelSha256(after)).not.toBe(modelSha256(before));
  });
});

describe('nextVersion', () => {
  it('starts at 1.0, increments the minor on resubmit and the major on amendment', () => {
    expect(nextVersion(null, 'minor')).toBe('1.0');
    expect(nextVersion('1.0', 'minor')).toBe('1.1');
    expect(nextVersion('1.9', 'minor')).toBe('1.10');
    expect(nextVersion('1.3', 'major')).toBe('2.0');
  });

  it('refuses a version it cannot parse rather than inventing one', () => {
    expect(() => nextVersion('draft', 'minor')).toThrow(TypeError);
  });
});

describe('diffReportModels', () => {
  it('reports the changed leaf with its dotted path, before and after', () => {
    const before = buildReportModel(input());
    const after = buildReportModel(
      input({
        version: '1.1',
        tests: [test({ observations: { ascending: [{ L: '10000', I: '10005' }] } })],
      }),
    );

    const { changes, total } = diffReportModels(before, after);
    const indication = changes.find((c) => c.path === 'tests.0.observations.ascending.0.I');
    expect(indication).toEqual({
      path: 'tests.0.observations.ascending.0.I',
      kind: 'changed',
      before: '10000',
      after: '10005',
    });
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('reports an added and a removed test row', () => {
    const before = buildReportModel(input());
    const after = buildReportModel(
      input({ tests: [test(), test({ testCode: 'CREEP', sequence: 20 })] }),
    );

    const { changes } = diffReportModels(before, after);
    expect(changes.some((c) => c.kind === 'added' && c.path.startsWith('tests.1'))).toBe(true);
  });

  it('finds nothing to report between identical snapshots', () => {
    const { changes, total } = diffReportModels(
      buildReportModel(input()),
      buildReportModel(input()),
    );
    expect(changes).toEqual([]);
    expect(summarizeChanges(changes, total)).toBe('No data changes.');
  });

  it('caps the change list but still reports the true total', () => {
    const wide = Array.from({ length: 60 }, (_, i) => ({ L: String(i), I: String(i) }));
    const before = buildReportModel(
      input({ tests: [test({ observations: { ascending: wide } })] }),
    );
    const after = buildReportModel(
      input({
        tests: [test({ observations: { ascending: wide.map((r) => ({ ...r, I: `${r.I}9` })) } })],
      }),
    );

    const { changes, total } = diffReportModels(before, after, 10);
    expect(changes).toHaveLength(10);
    expect(total).toBe(60);
    expect(summarizeChanges(changes, total)).toBe('60 fields changed across 1 test.');
  });
});
