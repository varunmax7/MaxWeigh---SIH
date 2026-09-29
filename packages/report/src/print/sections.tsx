/**
 * §8.1 items 1–5: cover, parties, instrument characteristics, test
 * conditions and equipment, summary of results.
 */
import type { ReportModel } from '@tula/schemas';
import { fmtDate, verdictLabel } from './format.js';

export function CoverSection({
  model,
  modelSha256,
  certificateNo,
  issuedAt,
  qrDataUrl,
}: {
  model: ReportModel;
  modelSha256: string;
  certificateNo: string | null;
  issuedAt: string | null;
  qrDataUrl?: string;
}) {
  return (
    <section className="avoid-break" style={{ marginBottom: '10mm' }}>
      <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Government of India · Ministry of Consumer Affairs, Food and Public Distribution
        <br />
        Department of Consumer Affairs · Legal Metrology
      </p>
      <h1 style={{ fontSize: '18pt', margin: '4mm 0 1mm' }}>
        Test report — {model.instrument.modelName}
      </h1>
      <p style={{ fontSize: '11pt', color: 'var(--muted-foreground, #5a6378)' }}>
        Type evaluation under OIML R 76-1:2006 · {model.lab.name}
      </p>

      <table style={{ marginTop: '6mm' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>
              <p>
                <strong>Report no.</strong> <span className="mono tabular">{model.reportNo}</span>
              </p>
              <p>
                <strong>Version</strong> <span className="tabular">{model.version}</span>
              </p>
              {certificateNo ? (
                <p>
                  <strong>Certificate no.</strong>{' '}
                  <span className="mono tabular">{certificateNo}</span>
                </p>
              ) : null}
              <p>
                <strong>Issue date</strong> {fmtDate(issuedAt)}
              </p>
              <p>
                <strong>Rule pack</strong>{' '}
                <span className="mono">
                  {model.provenance.rulepackId}@{model.provenance.rulepackVersion}
                </span>
              </p>
              <p>
                <strong>Reference no.</strong>{' '}
                <span className="mono tabular">{model.evaluation.refNo}</span>
              </p>
            </td>
            <td style={{ width: '50%', textAlign: 'right', verticalAlign: 'top' }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} width={96} height={96} alt="Verification QR code" />
              ) : null}
              <p className="mono tabular" style={{ fontSize: '8pt', wordBreak: 'break-all' }}>
                sha256:{modelSha256.slice(0, 16)}…
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: '9pt', marginTop: '6mm', color: 'var(--muted-foreground, #5a6378)' }}>
        भारत सरकार · उपभोक्ता मामले, खाद्य और सार्वजनिक वितरण मंत्रालय · उपभोक्ता मामले विभाग · विधिक माप
        विज्ञान
      </p>
    </section>
  );
}

export function PartiesSection({ model }: { model: ReportModel }) {
  return (
    <section className="avoid-break">
      <h2 style={{ fontSize: '13pt' }}>Applicant and manufacturer</h2>
      <table>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              <p style={{ fontWeight: 600 }}>Applicant</p>
              <p>{model.applicant.name}</p>
              {model.applicant.address ? <p>{model.applicant.address}</p> : null}
            </td>
            <td style={{ width: '50%', verticalAlign: 'top' }}>
              <p style={{ fontWeight: 600 }}>Manufacturer</p>
              <p>{model.manufacturer.name}</p>
              {model.manufacturer.address ? <p>{model.manufacturer.address}</p> : null}
              {model.manufacturer.country ? <p>{model.manufacturer.country}</p> : null}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function specField(spec: Record<string, unknown>, key: string): string {
  const value = spec[key];
  return value === undefined || value === null ? '—' : String(value);
}

export function InstrumentSection({ model }: { model: ReportModel }) {
  const spec = model.instrument.spec;
  const ranges = Array.isArray(spec.ranges) ? (spec.ranges as Record<string, unknown>[]) : [];
  return (
    <section className="avoid-break">
      <h2 style={{ fontSize: '13pt' }}>Instrument identification and technical characteristics</h2>
      <table>
        <tbody>
          <tr>
            <td>Model</td>
            <td>
              {model.instrument.modelName}
              {model.instrument.modelCode ? ` (${model.instrument.modelCode})` : ''}
            </td>
          </tr>
          <tr>
            <td>Accuracy class</td>
            <td>{specField(spec, 'accuracyClass')}</td>
          </tr>
          <tr>
            <td>Kind</td>
            <td>{specField(spec, 'kind')}</td>
          </tr>
          <tr>
            <td>Min</td>
            <td className="tabular">{specField(spec, 'min')} g</td>
          </tr>
          {ranges.map((range, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: ranges have no stable id of their own in the spec snapshot.
            <tr key={i}>
              <td>{`Range ${i + 1}: Max / e / d`}</td>
              <td className="tabular">
                {specField(range, 'max')} g / {specField(range, 'e')} g / {specField(range, 'd')} g
              </td>
            </tr>
          ))}
          <tr>
            <td>Sample serial no.</td>
            <td>{model.evaluation.sampleSerials.join(', ') || '—'}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export function ConditionsSection({ model }: { model: ReportModel }) {
  const standards = new Map<string, ReportModel['tests'][number]['standards'][number]>();
  for (const test of model.tests) {
    for (const s of test.standards) standards.set(s.setCode, s);
  }
  const ambient = model.tests.flatMap((t) =>
    [t.envStart, t.envEnd].flatMap((e) =>
      e && typeof e.tempC === 'number' ? [{ tempC: e.tempC, rhPct: e.rhPct }] : [],
    ),
  );
  const tempRange =
    ambient.length > 0
      ? `${Math.min(...ambient.map((a) => a.tempC))}–${Math.max(...ambient.map((a) => a.tempC))} °C`
      : '—';

  return (
    <section className="avoid-break">
      <h2 style={{ fontSize: '13pt' }}>Test conditions and equipment</h2>
      <p>
        <strong>Ambient temperature observed</strong> {tempRange}
      </p>
      {standards.size > 0 ? (
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Weight set</th>
              <th style={{ textAlign: 'left' }}>Class</th>
              <th style={{ textAlign: 'left' }}>Certificate</th>
              <th style={{ textAlign: 'left' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {[...standards.values()].map((s) => (
              <tr key={s.setCode}>
                <td className="mono">{s.setCode}</td>
                <td>{s.oimlClass}</td>
                <td>{s.certificateNo ?? '—'}</td>
                <td className="tabular">{fmtDate(s.dueOn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: 'var(--muted-foreground, #5a6378)' }}>
          No reference standards recorded.
        </p>
      )}
    </section>
  );
}

export function SummarySection({ model }: { model: ReportModel }) {
  const titleByCode = new Map(model.tests.map((t) => [t.testCode, t.title ?? t.testCode]));
  const clauseByCode = new Map(model.tests.map((t) => [t.testCode, t.clause]));
  return (
    <section className="avoid-break">
      <h2 style={{ fontSize: '13pt' }}>Summary of results</h2>
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Test</th>
            <th style={{ textAlign: 'left' }}>Clause</th>
            <th style={{ textAlign: 'left' }}>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {model.summary.rows.map((row) => (
            <tr key={row.code}>
              <td>{titleByCode.get(row.code) ?? row.code}</td>
              <td className="tabular">{clauseByCode.get(row.code) ?? '—'}</td>
              <td>{verdictLabel(row.verdict)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '12pt', fontWeight: 600, marginTop: '4mm' }}>
        Overall verdict: {verdictLabel(model.summary.overallVerdict)}
      </p>
    </section>
  );
}
