-- Fuzzy search over the values people actually type into a repository filter
-- (implementation.md §5). These can't be expressed through drizzle-kit's
-- typed index builder (it has no `gin_trgm_ops` operator class), so they're
-- raw SQL.
CREATE INDEX reports_report_no_trgm_idx ON reports USING gin (report_no gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX reports_certificate_no_trgm_idx ON reports USING gin (certificate_no gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX manufacturers_name_trgm_idx ON manufacturers USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX instrument_models_model_name_trgm_idx ON instrument_models USING gin (model_name gin_trgm_ops);
