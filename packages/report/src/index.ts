/**
 * @tula/report — one immutable ReportModel, two renderers.
 *
 * `buildReportModel()` snapshots an approved evaluation; the PDF (print route
 * rendered by Playwright) and the DOCX builder both consume that snapshot, so
 * the two documents can never disagree (implementation.md §3.2, §8).
 */

export * from './diff.js';
export * from './model.js';
