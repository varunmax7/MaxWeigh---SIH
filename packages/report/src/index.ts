/**
 * @tula/report — one immutable ReportModel, two renderers.
 *
 * `buildReportModel()` snapshots an approved evaluation; the PDF (print route
 * rendered by Playwright) and the DOCX builder both consume that snapshot, so
 * the two documents can never disagree (implementation.md §3.2, §8).
 */

/** Version of the ReportModel shape; bumped when the snapshot layout changes. */
export const REPORT_MODEL_VERSION = 1 as const;
