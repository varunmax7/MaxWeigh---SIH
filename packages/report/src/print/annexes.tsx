/**
 * §8.1 items 7–10: examination checklists, the calculation methodology
 * annex, the photographs/attachments manifest, and the conclusion +
 * signatory block.
 */
import type { ReportModel } from '@tula/schemas';
import { fmtDate } from './format.js';

const CHECKLIST_CODES = new Set(['EXAM_MARKINGS', 'EXAM_CONSTRUCTION']);

interface ChecklistItem {
  key: string;
  status: 'ok' | 'fail' | 'not_applicable';
  note?: string;
}

function checklistItems(observations: Record<string, unknown> | null): ChecklistItem[] {
  const items = observations?.items;
  return Array.isArray(items) ? (items as ChecklistItem[]) : [];
}

export function ChecklistSection({ model }: { model: ReportModel }) {
  const tests = model.tests.filter(
    (t) => CHECKLIST_CODES.has(t.testCode) && t.applicability === 'APPLICABLE',
  );
  if (tests.length === 0) return null;
  return (
    <section className="avoid-break page-break-before">
      <h2 style={{ fontSize: '13pt' }}>Examination checklists</h2>
      {tests.map((test) => (
        <div key={test.testCode} className="avoid-break" style={{ marginBottom: '4mm' }}>
          <p style={{ fontWeight: 600 }}>{test.title ?? test.testCode}</p>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th style={{ textAlign: 'left' }}>Result</th>
                <th style={{ textAlign: 'left' }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {checklistItems(test.observations).map((item) => (
                <tr key={item.key}>
                  <td>{item.key}</td>
                  <td>
                    {item.status === 'ok'
                      ? 'OK'
                      : item.status === 'fail'
                        ? 'Fail'
                        : 'Not applicable'}
                  </td>
                  <td>{item.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

/**
 * The calculation methodology annex (§8.1 item 8) — every formula and
 * worked example that produced a verdict, generated directly from the
 * engine's own `CalcStep`s (never re-derived here — §11).
 */
export function MethodologySection({ model }: { model: ReportModel }) {
  if (model.methodology.length === 0) return null;
  const titleByCode = new Map(model.tests.map((t) => [t.testCode, t.title ?? t.testCode]));
  return (
    <section className="avoid-break page-break-before">
      <h2 style={{ fontSize: '13pt' }}>Calculation methodology</h2>
      {model.methodology.map((entry) => (
        <div
          key={`${entry.testCode}-${entry.rangeIndex}`}
          className="avoid-break"
          style={{ marginBottom: '4mm' }}
        >
          <p style={{ fontWeight: 600 }}>
            {titleByCode.get(entry.testCode) ?? entry.testCode}
            {entry.rangeIndex > 0 ? ` — range ${entry.rangeIndex + 1}` : ''}
          </p>
          <ol>
            {entry.steps.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a step trail has no id of its own, and is never reordered.
              <li key={i}>
                <span style={{ fontWeight: 600 }}>{step.label}</span>
                {step.clause ? <span className="tabular"> (clause {step.clause})</span> : null}
                <br />
                <span className="tabular mono">{step.formula}</span>
                <br />
                <span className="tabular">{step.substituted}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

/**
 * §8.1 item 9. A manifest — filename, caption, SHA-256 — not embedded image
 * bytes: the model is rendered with no live queries (implementation.md's
 * P8 kickoff), and an attachment's bytes live in object storage, not in the
 * hashed snapshot itself. See docs/QUESTIONS.md for the embedding question.
 */
export function AttachmentsSection({ model }: { model: ReportModel }) {
  if (model.attachments.length === 0) return null;
  return (
    <section className="avoid-break page-break-before">
      <h2 style={{ fontSize: '13pt' }}>Photographs and attachments</h2>
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Filename</th>
            <th style={{ textAlign: 'left' }}>Caption</th>
            <th style={{ textAlign: 'left' }}>SHA-256</th>
          </tr>
        </thead>
        <tbody>
          {model.attachments.map((a) => (
            <tr key={a.sha256}>
              <td>{a.filename}</td>
              <td>{a.caption ?? '—'}</td>
              <td className="mono" style={{ fontSize: '8pt', wordBreak: 'break-all' }}>
                {a.sha256}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export interface SignatoryEntry {
  tier: 1 | 2 | 3;
  name: string;
  designation: string | null;
  decidedAt: string;
}

const TIER_TITLE: Record<1 | 2 | 3, string> = {
  1: 'Tier 1 — verified by',
  2: 'Tier 2 — approved by',
  3: 'Tier 3 — sealed by',
};

export function SignatorySection({
  model,
  modelSha256,
  signatories,
}: {
  model: ReportModel;
  modelSha256: string;
  signatories: SignatoryEntry[];
}) {
  return (
    <section className="avoid-break page-break-before">
      <h2 style={{ fontSize: '13pt' }}>Conclusion and signatory block</h2>
      <p>
        This report reflects the results of type evaluation testing performed against OIML R
        76-1:2006, rule pack {model.provenance.rulepackId}@{model.provenance.rulepackVersion}.
      </p>
      <table>
        <tbody>
          {([1, 2, 3] as const).map((tier) => {
            const signed = signatories.find((s) => s.tier === tier);
            return (
              <tr key={tier}>
                <td style={{ width: '35%' }}>{TIER_TITLE[tier]}</td>
                <td>
                  {signed ? (
                    <>
                      {signed.name}
                      {signed.designation ? `, ${signed.designation}` : ''} —{' '}
                      {fmtDate(signed.decidedAt)}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p
        className="mono tabular"
        style={{ fontSize: '8pt', marginTop: '4mm', wordBreak: 'break-all' }}
      >
        Content hash (SHA-256): {modelSha256}
      </p>
    </section>
  );
}
