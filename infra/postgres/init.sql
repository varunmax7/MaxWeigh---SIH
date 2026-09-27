-- Extensions Tula depends on. Runs once, on first cluster initialisation.
--   pg_trgm  — fuzzy search over model names, applicants and certificate numbers (§9)
--   pgcrypto — gen_random_uuid() and digest() for the audit ledger hash chain (§9)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
