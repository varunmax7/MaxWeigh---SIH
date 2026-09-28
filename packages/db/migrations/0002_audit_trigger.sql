-- The append-only guarantee (implementation.md §5, §9): once a row lands in
-- audit_log it can never be changed or removed by anything but a superuser
-- explicitly bypassing this trigger (which is exactly what the tamper-detection
-- test in `audit-ledger.test.ts` does, to prove `verifyChain()` catches it).
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;
--> statement-breakpoint

CREATE TRIGGER audit_log_append_only_trigger
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
--> statement-breakpoint

-- The chain always has exactly one head row to lock (`SELECT ... FOR UPDATE`)
-- before appending; `insertAuditEntry` (packages/db/src/audit-ledger.ts)
-- upserts it, but it must exist from the start for that lock to have
-- something to grab.
INSERT INTO audit_head (id, last_id, last_hash) VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
