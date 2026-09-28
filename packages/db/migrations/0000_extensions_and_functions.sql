-- Extensions and helper functions every later migration depends on.
--
-- pg_trgm  — fuzzy search over model names, applicants and certificate numbers (§9)
-- pgcrypto — gen_random_bytes()/digest() used below
--
-- infra/postgres/init.sql already enables both on a fresh dev container; this
-- repeats it (IF NOT EXISTS) so the same migration set also stands up a
-- database that was not created from that init script (e.g. production).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

-- uuid PKs are v7 (implementation.md §5): the high 48 bits are a millisecond
-- Unix timestamp, so ids sort chronologically and stay index-friendly, unlike
-- v4. Postgres 16 has no built-in `uuidv7()` (that lands in a later major),
-- so every table's `id` column defaults to this instead. Verified against a
-- live database: version nibble is 7, variant nibble is 8-b (RFC 9562), and
-- ids minted in the same millisecond still increase monotonically because
-- the random suffix breaks ties only within that millisecond.
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE sql VOLATILE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;
