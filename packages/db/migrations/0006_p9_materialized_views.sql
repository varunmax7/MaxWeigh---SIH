-- Analytics views for the dashboard (implementation.md §5, §7.5, §10 P9).
--
-- All three are MATERIALIZED and refreshed every 5 min by the worker's
-- `analytics.refresh` job (`refresh_analytics_views()` below) — they back the
-- 12-month throughput chart and the verdict donut, both of which read fine a
-- few minutes stale. The exact KPI-strip counts (Total evaluations, In
-- testing, ...) are intentionally NOT sourced from a view — they run as
-- plain live queries in `server/queries/dashboard.ts` so "Dashboard numbers
-- equal direct SQL counts" (§10 P9 acceptance) holds without needing a
-- refresh first.
--
-- §5 also names a fourth view, `v_pending_actions` ("per tier with SLA
-- age"), materialized. It is NOT built here: P7 already shipped
-- `listNeedsYourAction()` (`apps/web/src/server/queries/review.ts`) as a
-- live, role-aware query with the same "per tier, SLA age" shape the
-- dashboard's "Needs your action" panel needs — reusing it, instead of a
-- second, materialized (and therefore staler) implementation of the same
-- thing, is the P9 decision logged in docs/QUESTIONS.md.
--
-- Can't be expressed through drizzle-kit's typed builders (no materialized
-- view / raw view support in the version pinned here), so — like 0002's
-- trigger and 0003's trigram indexes — this is hand-written SQL with no
-- corresponding `schema/*.ts` change.

CREATE MATERIALIZED VIEW v_eval_monthly AS
SELECT
  lab_id,
  date_trunc('month', issued_at) AS month,
  count(*) FILTER (WHERE overall_verdict = 'CONFORMS') AS conforms_count,
  count(*) FILTER (WHERE overall_verdict = 'DOES_NOT_CONFORM') AS not_conform_count
FROM evaluations
WHERE status = 'ISSUED' AND issued_at IS NOT NULL
GROUP BY lab_id, date_trunc('month', issued_at);
--> statement-breakpoint
CREATE UNIQUE INDEX v_eval_monthly_pk ON v_eval_monthly (lab_id, month);
--> statement-breakpoint

CREATE MATERIALIZED VIEW v_verdict_by_class AS
SELECT
  lab_id,
  coalesce(spec_snapshot ->> 'accuracyClass', 'unknown') AS accuracy_class,
  overall_verdict,
  count(*) AS n
FROM evaluations
WHERE status = 'ISSUED'
GROUP BY lab_id, coalesce(spec_snapshot ->> 'accuracyClass', 'unknown'), overall_verdict;
--> statement-breakpoint
CREATE UNIQUE INDEX v_verdict_by_class_pk ON v_verdict_by_class (lab_id, accuracy_class, overall_verdict);
--> statement-breakpoint

-- issued − created (§5), aggregated to monthly averages per lab.
CREATE MATERIALIZED VIEW v_turnaround AS
SELECT
  lab_id,
  date_trunc('month', issued_at) AS month,
  avg(extract(epoch FROM (issued_at - created_at)) / 86400.0) AS avg_days,
  count(*) AS n
FROM evaluations
WHERE status = 'ISSUED' AND issued_at IS NOT NULL
GROUP BY lab_id, date_trunc('month', issued_at);
--> statement-breakpoint
CREATE UNIQUE INDEX v_turnaround_pk ON v_turnaround (lab_id, month);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_analytics_views() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_eval_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_verdict_by_class;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_turnaround;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Fuzzy search over ref_no (⌘K palette, §7.4), matching the treatment
-- report_no/certificate_no already got in 0003.
CREATE INDEX evaluations_ref_no_trgm_idx ON evaluations USING gin (ref_no gin_trgm_ops);
--> statement-breakpoint

-- Supports both `refresh_analytics_views()` and any live issued-date-range
-- query (dashboard FY filter, turnaround).
CREATE INDEX evaluations_issued_at_idx ON evaluations (issued_at) WHERE status = 'ISSUED';
