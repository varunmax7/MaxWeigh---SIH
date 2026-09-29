import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildReportModel } from '../model.js';
import { CertificateDocument } from './CertificateDocument.js';
import { ReportDocument } from './ReportDocument.js';

const goldenWeighingResult = {
  verdict: 'FAIL' as const,
  rows: [
    {
      rowId: 'asc-r1',
      P: '10001.5',
      E: '1.5',
      Ec: '1.5',
      EcInE: '0.30',
      mpe: '5.0',
      mpeInE: '1.00',
      verdict: 'PASS' as const,
      issues: [],
      steps: [
        {
          label: 'Corrected error',
          formula: 'Ec = E − E0',
          substituted: 'Ec = 1.5 − (−0.5) = 1.5',
          result: '1.5',
          clause: '4.5',
        },
      ],
    },
    {
      rowId: 'asc-r2',
      P: '2508.5',
      E: '3.0',
      Ec: '3.5',
      EcInE: '0.70',
      mpe: '2.5',
      mpeInE: '0.50',
      verdict: 'FAIL' as const,
      issues: [],
    },
  ],
  summary: { maxAbsEc: '3.5' },
  issues: [],
  steps: [
    {
      label: 'Zero-reference error',
      formula: 'E0 = P0 − L0',
      substituted: 'E0 = 49.5 − 50 = -0.5',
      result: '-0.5',
      clause: '4.5',
    },
  ],
  engineVersion: '0.1.0',
  rulepack: { id: 'oiml-r76-1-2006', version: '1.0.0' },
};

function buildFixtureModel() {
  return buildReportModel({
    reportNo: 'TR-RRSL-BLR-2026-0001',
    version: '1.0',
    lab: {
      code: 'RRSL-BLR',
      name: 'RRSL Bengaluru',
      address: '123 Metrology Road',
      state: 'Karnataka',
      accreditationNo: 'NABL-T-1234',
    },
    evaluation: { refNo: 'EV-RRSL-BLR-2026-0142', sampleSerials: ['SN-1'], priority: 'normal' },
    applicant: { name: 'Apex Scales Pvt Ltd', address: 'MG Road, Bengaluru', country: 'IN' },
    manufacturer: { name: 'Apex Manufacturing', address: 'Industrial Area', country: 'IN' },
    instrument: {
      modelName: 'AP-30',
      modelCode: 'AP30',
      spec: {
        accuracyClass: 'III',
        kind: 'single',
        ranges: [{ max: '30000', e: '5', d: '5' }],
        min: '100',
      },
    },
    provenance: {
      rulepackId: 'oiml-r76-1-2006',
      rulepackVersion: '1.0.0',
      engineVersion: '0.1.0',
    },
    tests: [
      {
        testCode: 'WEIGHING',
        rangeIndex: 0,
        sequence: 10,
        clause: '3.5.1',
        title: 'Weighing test',
        applicability: 'APPLICABLE',
        naReason: null,
        verdict: 'FAIL',
        params: null,
        observations: {
          zeroRef: { L: '50', I: '50', deltaL: '3.0' },
          ascending: [
            { rowId: 'r1', L: '10000', I: '10000', deltaL: '1.5' },
            { rowId: 'r2', L: '2500', I: '2505', deltaL: '4.5' },
          ],
          descending: [],
        },
        result: goldenWeighingResult,
        envStart: { tempC: 22.3, rhPct: 54 },
        envEnd: { tempC: 22.6, rhPct: 55 },
        completedAt: '2026-09-29T06:00:00.000Z',
        completedByName: 'Seed Testing Officer',
        standards: [
          {
            setCode: 'WS-F2-09',
            oimlClass: 'F2',
            certificateNo: 'CAL-2024-11',
            dueOn: '2027-03-01',
          },
        ],
      },
      {
        testCode: 'EXAM_MARKINGS',
        rangeIndex: 0,
        sequence: 1,
        clause: '3.9.1',
        title: 'Markings',
        applicability: 'APPLICABLE',
        naReason: null,
        verdict: 'PASS',
        params: null,
        observations: {
          items: [
            { key: 'Manufacturer mark', status: 'ok' },
            { key: 'Accuracy class', status: 'ok', note: 'III, printed on the dial' },
          ],
        },
        result: {
          verdict: 'PASS',
          rows: [],
          summary: {},
          issues: [],
          steps: [],
          engineVersion: '0.1.0',
          rulepack: { id: 'oiml-r76-1-2006', version: '1.0.0' },
        },
        envStart: null,
        envEnd: null,
        completedAt: '2026-09-29T05:00:00.000Z',
        completedByName: 'Seed Testing Officer',
        standards: [],
      },
      {
        testCode: 'ZERO_TRACKING',
        rangeIndex: 0,
        sequence: 20,
        clause: null,
        title: 'Zero tracking',
        applicability: 'NOT_APPLICABLE',
        naReason: 'Instrument has no zero-tracking device.',
        verdict: null,
        params: null,
        observations: null,
        result: null,
        envStart: null,
        envEnd: null,
        completedAt: null,
        completedByName: null,
        standards: [],
      },
    ],
    attachments: [
      {
        filename: 'nameplate.jpg',
        caption: 'Nameplate close-up',
        mime: 'image/jpeg',
        sha256: 'a'.repeat(64),
      },
    ],
  });
}

describe('ReportDocument', () => {
  it('renders every §8.1 section without throwing, DRAFT watermark included', () => {
    const model = buildFixtureModel();
    const html = renderToStaticMarkup(
      <ReportDocument
        model={model}
        modelSha256={'b'.repeat(64)}
        sealed={false}
        certificateNo={null}
        issuedAt={null}
        signatories={[]}
        versions={[{ version: '1.0', status: 'DRAFT', changeSummary: null }]}
      />,
    );

    expect(html).toContain('DRAFT — NOT VALID');
    expect(html).toContain('Weighing test');
    expect(html).toContain('EV-RRSL-BLR-2026-0142');
    expect(html).toContain('Apex Scales Pvt Ltd');
    expect(html).toContain('Manufacturer mark');
    expect(html).toContain('Not applicable');
    expect(html).toContain('E0 = P0 − L0');
    expect(html).toContain('nameplate.jpg');
    // The envelope chart only draws for the one test whose rows carry a
    // recoverable load (WEIGHING) — confirms the generic rowId→L match works.
    expect(html).toContain('<svg');
  });

  it('omits the watermark once Tier 3 has approved, and shows the signatory chain', () => {
    const model = buildFixtureModel();
    const html = renderToStaticMarkup(
      <ReportDocument
        model={model}
        modelSha256={'c'.repeat(64)}
        sealed={true}
        certificateNo={null}
        issuedAt="2026-09-30T00:00:00.000Z"
        signatories={[
          {
            tier: 1,
            name: 'Seed Senior Testing Officer',
            designation: 'STO',
            decidedAt: '2026-09-29T10:00:00.000Z',
          },
          {
            tier: 2,
            name: 'Seed Chief Metrology Officer',
            designation: 'CMO',
            decidedAt: '2026-09-29T12:00:00.000Z',
          },
          {
            tier: 3,
            name: 'Seed Controller',
            designation: 'Controller',
            decidedAt: '2026-09-29T14:00:00.000Z',
          },
        ]}
        versions={[{ version: '1.0', status: 'SIGNED', changeSummary: null }]}
      />,
    );

    expect(html).not.toContain('DRAFT — NOT VALID');
    expect(html).toContain('Seed Controller');
    expect(html).toContain(`Content hash (SHA-256): ${'c'.repeat(64)}`);
  });

  it('marks a DOES_NOT_CONFORM overall verdict correctly from a FAIL row', () => {
    const model = buildFixtureModel();
    expect(model.summary.overallVerdict).toBe('DOES_NOT_CONFORM');
  });
});

describe('CertificateDocument', () => {
  it('renders with the seal styling once a Tier 3 signature exists', () => {
    const model = buildFixtureModel();
    const html = renderToStaticMarkup(
      <CertificateDocument
        model={model}
        modelSha256={'d'.repeat(64)}
        certificateNo="IN-R76-RRSL-BLR-2026-0001"
        issuedAt="2026-09-30T00:00:00.000Z"
        validUntil={null}
        signatories={[
          {
            tier: 3,
            name: 'Seed Controller',
            designation: 'Controller',
            decidedAt: '2026-09-29T14:00:00.000Z',
          },
        ]}
      />,
    );

    expect(html).toContain('IN-R76-RRSL-BLR-2026-0001');
    expect(html).toContain('Certificate of Conformity');
    expect(html).toContain('Sealed by Seed Controller');
    expect(html).toContain('Not time-limited');
  });

  it('shows "Pending seal" before Tier 3 has signed', () => {
    const model = buildFixtureModel();
    const html = renderToStaticMarkup(
      <CertificateDocument
        model={model}
        modelSha256={'e'.repeat(64)}
        certificateNo="IN-R76-RRSL-BLR-2026-0001"
        issuedAt={null}
        validUntil={null}
        signatories={[]}
      />,
    );
    expect(html).toContain('Pending seal');
  });
});
