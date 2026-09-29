/**
 * The DOCX builder (implementation.md §8.2: "same section order, real Word
 * tables (editable)... clearly marked 'Editable copy — the signed PDF is
 * the authoritative record'"). Reads the identical `ReportModel` snapshot
 * the print/PDF route renders — never a live query — so the two documents
 * can never disagree (§3.2 principle 5).
 */
import type { ReportModel } from '@tula/schemas';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { SignatoryEntry } from '../print/annexes.js';
import { fmtDate, verdictLabel } from '../print/format.js';

const CELL_MARGIN = { top: 60, bottom: 60, left: 100, right: 100 };

function row(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        children: [new Paragraph(value)],
      }),
    ],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 150 },
  });
}

function resultsTable(model: ReportModel): Table {
  const titleByCode = new Map(model.tests.map((t) => [t.testCode, t.title ?? t.testCode]));
  const header = new TableRow({
    tableHeader: true,
    children: ['Test', 'Clause', 'Verdict'].map(
      (text) =>
        new TableCell({
          margins: CELL_MARGIN,
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        }),
    ),
  });
  const clauseByCode = new Map(model.tests.map((t) => [t.testCode, t.clause]));
  const rows = model.summary.rows.map(
    (r) =>
      new TableRow({
        children: [
          titleByCode.get(r.code) ?? r.code,
          clauseByCode.get(r.code) ?? '—',
          verdictLabel(r.verdict),
        ].map((text) => new TableCell({ margins: CELL_MARGIN, children: [new Paragraph(text)] })),
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

function testSheetRowsTable(test: ReportModel['tests'][number]): Table | null {
  const rows = test.result?.rows ?? [];
  if (rows.length === 0) return null;
  const header = new TableRow({
    tableHeader: true,
    children: ['Row', 'Ec', 'Ec / e', 'MPE', 'Result'].map(
      (text) =>
        new TableCell({
          margins: CELL_MARGIN,
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        }),
    ),
  });
  const body = rows.map(
    (r) =>
      new TableRow({
        children: [r.rowId, r.Ec ?? '—', r.EcInE ?? '—', r.mpe ?? '—', verdictLabel(r.verdict)].map(
          (text) => new TableCell({ margins: CELL_MARGIN, children: [new Paragraph(text)] }),
        ),
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

const TIER_TITLE: Record<1 | 2 | 3, string> = {
  1: 'Tier 1 — verified by',
  2: 'Tier 2 — approved by',
  3: 'Tier 3 — sealed by',
};

export interface BuildReportDocxInput {
  model: ReportModel;
  modelSha256: string;
  certificateNo: string | null;
  issuedAt: string | null;
  signatories: SignatoryEntry[];
}

/** Builds the DOCX and returns its bytes. */
export async function buildReportDocx({
  model,
  modelSha256,
  certificateNo,
  issuedAt,
  signatories,
}: BuildReportDocxInput): Promise<Buffer> {
  const applicableTests = model.tests.filter((t) => t.applicability === 'APPLICABLE');

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: 'Editable copy — the signed PDF is the authoritative record.',
          italics: true,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `Test report — ${model.instrument.modelName}`,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      text: `Type evaluation under OIML R 76-1:2006 · ${model.lab.name}`,
      spacing: { after: 200 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row('Report no.', model.reportNo),
        row('Version', model.version),
        ...(certificateNo ? [row('Certificate no.', certificateNo)] : []),
        row('Issue date', fmtDate(issuedAt)),
        row('Rule pack', `${model.provenance.rulepackId}@${model.provenance.rulepackVersion}`),
        row('Reference no.', model.evaluation.refNo),
      ],
    }),

    heading('Applicant and manufacturer'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [row('Applicant', model.applicant.name), row('Manufacturer', model.manufacturer.name)],
    }),

    heading('Instrument identification and technical characteristics'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row('Model', model.instrument.modelName),
        row('Accuracy class', String(model.instrument.spec.accuracyClass ?? '—')),
        row('Sample serial no.', model.evaluation.sampleSerials.join(', ') || '—'),
      ],
    }),

    heading('Summary of results'),
    resultsTable(model),
    new Paragraph({
      spacing: { before: 150 },
      children: [
        new TextRun({
          text: `Overall verdict: ${verdictLabel(model.summary.overallVerdict)}`,
          bold: true,
        }),
      ],
    }),
  ];

  for (const test of applicableTests) {
    children.push(
      new Paragraph({
        text: `${test.title ?? test.testCode}${test.rangeIndex > 0 ? ` — range ${test.rangeIndex + 1}` : ''}`,
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: true,
      }),
    );
    const table = testSheetRowsTable(test);
    if (table) children.push(table);
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Verdict: ${verdictLabel(test.verdict ?? test.result?.verdict ?? 'INCOMPLETE')}`,
            bold: true,
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      text: 'Conclusion and signatory block',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: ([1, 2, 3] as const).map((tier) => {
        const signed = signatories.find((s) => s.tier === tier);
        return row(
          TIER_TITLE[tier],
          signed
            ? `${signed.name}${signed.designation ? `, ${signed.designation}` : ''} — ${fmtDate(signed.decidedAt)}`
            : '—',
        );
      }),
    }),
    new Paragraph({
      spacing: { before: 150 },
      children: [new TextRun({ text: `Content hash (SHA-256): ${modelSha256}`, size: 16 })],
    }),
  );

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `${model.reportNo} v${model.version}`, size: 16 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Page ', size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
                  new TextRun({ text: ' of ', size: 16 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
