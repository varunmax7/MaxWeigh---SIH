/**
 * The test report document (implementation.md §8.1's ten-section order),
 * rendered from one `ReportModel` snapshot and nothing else — see the P8
 * kickoff note: "never query live tables while rendering." Everything this
 * component needs beyond the model itself (the signatory chain, whether the
 * PDF is signed yet) is per-version, immutable history the caller already
 * fetched by `report_version_id` — not a live table that could have moved
 * on since sealing.
 */
import type { ReportModel } from '@tula/schemas';
import type { SignatoryEntry } from './annexes.js';
import {
  AttachmentsSection,
  ChecklistSection,
  MethodologySection,
  SignatorySection,
} from './annexes.js';
import {
  ConditionsSection,
  CoverSection,
  InstrumentSection,
  PartiesSection,
  SummarySection,
} from './sections.js';
import { PRINT_CSS } from './styles.js';
import { TestSheet } from './TestSheet.js';

export interface ReportVersionSummary {
  version: string;
  status: string;
  changeSummary: string | null;
}

export interface ReportDocumentProps {
  model: ReportModel;
  modelSha256: string;
  /**
   * Whether Tier 3 has approved *this exact version* (an `approvals` row,
   * `tier: 3, decision: 'APPROVED'`, bound to this `report_version_id`) —
   * deliberately not `report_versions.status === 'SIGNED'` and not
   * `evaluations.status === 'ISSUED'`. The worker's `report.render` job
   * always runs *before* `report.sign`, while the version is still `DRAFT`
   * by construction (that very capture is what gets signed) — gating on
   * `SIGNED` would bake "DRAFT — NOT VALID" into every final signed PDF
   * permanently. `evaluations.status` is wrong for a different reason: it
   * describes the evaluation's *current* state, which has moved on by the
   * time someone views an old, already-signed version during a later
   * amendment cycle. A version-scoped Tier 3 approval is the one signal
   * that is both immutable and set at the right moment (synchronously, on
   * approval — before rendering is even enqueued).
   */
  sealed: boolean;
  certificateNo: string | null;
  issuedAt: string | null;
  signatories: SignatoryEntry[];
  versions: ReportVersionSummary[];
  qrDataUrl?: string;
}

function VersionHistorySection({ versions }: { versions: ReportVersionSummary[] }) {
  if (versions.length <= 1) return null;
  return (
    <section className="avoid-break">
      <h3 style={{ fontSize: '11pt' }}>Version history</h3>
      <ul>
        {versions.map((v) => (
          <li key={v.version}>
            <span className="tabular">v{v.version}</span> — {v.changeSummary ?? 'First submission.'}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * `previews always go through the same route` (§8.2) is what this
 * component's DRAFT watermark is for: the identical markup renders both the
 * worker's PDF capture and the officer's live preview, and the watermark is
 * the same reason either way — the report is not yet a signed record.
 */
export function ReportDocument({
  model,
  modelSha256,
  sealed,
  certificateNo,
  issuedAt,
  signatories,
  versions,
  qrDataUrl,
}: ReportDocumentProps) {
  const applicableTests = model.tests.filter((t) => t.applicability === 'APPLICABLE');

  return (
    <div className="tula-report">
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: a static, package-owned CSS string — never user input. */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      {!sealed ? (
        <div className="tula-watermark">
          <span>DRAFT — NOT VALID</span>
        </div>
      ) : null}

      <CoverSection
        model={model}
        modelSha256={modelSha256}
        certificateNo={certificateNo}
        issuedAt={issuedAt}
        qrDataUrl={qrDataUrl}
      />
      <PartiesSection model={model} />
      <InstrumentSection model={model} />
      <ConditionsSection model={model} />
      <SummarySection model={model} />

      {applicableTests.map((test) => (
        <TestSheet key={`${test.testCode}-${test.rangeIndex}`} test={test} />
      ))}

      <ChecklistSection model={model} />
      <MethodologySection model={model} />
      <AttachmentsSection model={model} />

      <div className="page-break-before">
        <SignatorySection model={model} modelSha256={modelSha256} signatories={signatories} />
        <VersionHistorySection versions={versions} />
      </div>
    </div>
  );
}
