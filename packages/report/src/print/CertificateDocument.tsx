/**
 * The certificate of conformity (implementation.md §8.1: "only when the
 * verdict is CONFORMS... kept as a configurable template" — the real
 * prescribed format under the Legal Metrology (Approval of Models) Rules,
 * 2011 is unconfirmed; see docs/QUESTIONS.md). One page, brass-accented
 * (§7.1: brass marks legal finality) once actually sealed.
 */
import type { ReportModel } from '@tula/schemas';
import type { SignatoryEntry } from './annexes.js';
import { fmtDate } from './format.js';
import { PRINT_CSS } from './styles.js';

export interface CertificateDocumentProps {
  model: ReportModel;
  modelSha256: string;
  certificateNo: string;
  issuedAt: string | null;
  validUntil: string | null;
  signatories: SignatoryEntry[];
  qrDataUrl?: string;
}

export function CertificateDocument({
  model,
  modelSha256,
  certificateNo,
  issuedAt,
  validUntil,
  signatories,
  qrDataUrl,
}: CertificateDocumentProps) {
  const sealed = signatories.some((s) => s.tier === 3);
  const spec = model.instrument.spec;

  return (
    <div className="tula-report">
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: a static, package-owned CSS string — never user input. */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div
        style={{
          border: `2px solid ${sealed ? 'var(--seal, #7a5a14)' : 'var(--border, #dce1ea)'}`,
          padding: '12mm',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Government of India · Department of Consumer Affairs · Legal Metrology
        </p>
        <h1 style={{ fontSize: '16pt', margin: '6mm 0' }}>Certificate of Conformity</h1>
        <p style={{ fontSize: '10pt', color: 'var(--muted-foreground, #5a6378)' }}>
          Issued under the Legal Metrology (Approval of Models) Rules, 2011, on the basis of type
          evaluation against OIML R 76-1:2006
        </p>

        <p
          className="mono tabular"
          style={{
            fontSize: '13pt',
            fontWeight: 700,
            margin: '6mm 0',
            color: sealed ? 'var(--seal, #7a5a14)' : undefined,
          }}
        >
          {certificateNo}
        </p>

        <table style={{ textAlign: 'left', margin: '0 auto', maxWidth: '140mm' }}>
          <tbody>
            <tr>
              <td>Manufacturer</td>
              <td>{model.manufacturer.name}</td>
            </tr>
            <tr>
              <td>Model</td>
              <td>{model.instrument.modelName}</td>
            </tr>
            <tr>
              <td>Accuracy class</td>
              <td>{String(spec.accuracyClass ?? '—')}</td>
            </tr>
            <tr>
              <td>Max / Min</td>
              <td className="tabular">
                {(() => {
                  const ranges = Array.isArray(spec.ranges)
                    ? (spec.ranges as Record<string, unknown>[])
                    : [];
                  const last = ranges[ranges.length - 1];
                  const max = last && typeof last.max === 'string' ? `${last.max} g` : '—';
                  const min = typeof spec.min === 'string' ? `${spec.min} g` : '—';
                  return `${max} / ${min}`;
                })()}
              </td>
            </tr>
            <tr>
              <td>Issuing lab</td>
              <td>{model.lab.name}</td>
            </tr>
            <tr>
              <td>Issue date</td>
              <td>{fmtDate(issuedAt)}</td>
            </tr>
            <tr>
              <td>Valid until</td>
              <td>{validUntil ? fmtDate(validUntil) : 'Not time-limited'}</td>
            </tr>
            <tr>
              <td>Test report</td>
              <td className="mono">
                {model.reportNo} v{model.version}
              </td>
            </tr>
          </tbody>
        </table>

        {qrDataUrl ? (
          <div style={{ marginTop: '8mm' }}>
            <img src={qrDataUrl} width={90} height={90} alt="Verification QR code" />
          </div>
        ) : null}

        <p
          className="mono tabular"
          style={{ fontSize: '7pt', marginTop: '4mm', wordBreak: 'break-all' }}
        >
          Report content hash: {modelSha256}
        </p>

        <p style={{ marginTop: '10mm' }}>
          {signatories.find((s) => s.tier === 3)
            ? `Sealed by ${signatories.find((s) => s.tier === 3)?.name}`
            : 'Pending seal'}
        </p>
      </div>
    </div>
  );
}
