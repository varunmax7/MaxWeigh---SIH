import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildReportModel } from '../model.js';
import { buildReportDocx } from './buildReportDocx.js';

function fixtureModel() {
  return buildReportModel({
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
    applicant: { name: 'Apex Scales Pvt Ltd', address: null, country: 'IN' },
    manufacturer: { name: 'Apex Manufacturing', address: null, country: 'IN' },
    instrument: {
      modelName: 'AP-30',
      modelCode: 'AP30',
      spec: { accuracyClass: 'III', ranges: [{ max: '30000', e: '5', d: '5' }], min: '100' },
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
        verdict: 'PASS',
        params: null,
        observations: {
          zeroRef: { L: '50', I: '50', deltaL: '3.0' },
          ascending: [{ rowId: 'r1', L: '10000', I: '10000', deltaL: '1.5' }],
          descending: [],
        },
        result: {
          verdict: 'PASS',
          rows: [
            { rowId: 'asc-r1', Ec: '1.5', EcInE: '0.30', mpe: '5.0', verdict: 'PASS', issues: [] },
          ],
          summary: {},
          issues: [],
          steps: [],
          engineVersion: '0.1.0',
          rulepack: { id: 'oiml-r76-1-2006', version: '1.0.0' },
        },
        envStart: null,
        envEnd: null,
        completedAt: '2026-09-29T06:00:00.000Z',
        completedByName: 'Seed Testing Officer',
        standards: [],
      },
    ],
    attachments: [],
  });
}

describe('buildReportDocx', () => {
  it('produces a well-formed OOXML package containing the report content', async () => {
    const model = fixtureModel();
    const buffer = await buildReportDocx({
      model,
      modelSha256: 'b'.repeat(64),
      certificateNo: 'IN-R76-RRSL-BLR-2026-0001',
      issuedAt: '2026-09-30T00:00:00.000Z',
      signatories: [
        {
          tier: 3,
          name: 'Seed Controller',
          designation: 'Controller',
          decidedAt: '2026-09-29T14:00:00.000Z',
        },
      ],
    });

    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('_rels/.rels')).not.toBeNull();
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeTruthy();

    for (const needle of [
      'Apex Scales Pvt Ltd',
      'EV-RRSL-BLR-2026-0142',
      'Editable copy',
      'Weighing test',
      'asc-r1',
      'Seed Controller',
      'IN-R76-RRSL-BLR-2026-0001',
      `Content hash (SHA-256): ${'b'.repeat(64)}`,
    ]) {
      expect(documentXml).toContain(needle);
    }
  });

  it('omits the certificate row when no certificate has been issued', async () => {
    const model = fixtureModel();
    const buffer = await buildReportDocx({
      model,
      modelSha256: 'c'.repeat(64),
      certificateNo: null,
      issuedAt: null,
      signatories: [],
    });

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).not.toContain('Certificate no.');
  });
});
