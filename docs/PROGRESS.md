# Tula — progress log

| Phase | Status | Started | Finished | Evidence |
|---|---|---|---|---|
| P0 Foundation | ☑ | 2026-09-27 | 2026-09-28 | command output below |
| P1 Engine | ☑ | 2026-09-28 | 2026-09-28 | coverage report + demo output below |
| P2 Core | ☑ | 2026-09-28 | 2026-09-28 | command output below |
| P3 UI system | ☐ | | | docs/screens/p3/ |
| P4 Master data | ☐ | | | |
| P5 Intake | ☐ | | | |
| P6 Workspace | ☐ | | | |
| P7 Workflow | ☐ | | | |
| P8 Reports | ☐ | | | sample PDF/DOCX paths |
| P9 Insights | ☐ | | | bench output |
| P10 Integrations | ☐ | | | |
| P11 Hardening | ☐ | | | CI run link |
| P12 Release | ☐ | | | |

## P0 — Foundation and tooling

- [x] pnpm workspace + `turbo.json` pipelines: `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `clean`.
- [x] `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`; `.nvmrc` = 22; `.editorconfig`.
- [x] Biome config (format + lint + import sorting), root scripts.
- [x] `apps/web`: Next.js 16 App Router, `src/`, TypeScript, Tailwind v4, `@/*` alias; `/` → 307 → `/login` placeholder.
- [x] `apps/worker`: TypeScript, `tsx` for dev, pg-boss bootstrap logging "worker ready", graceful SIGINT/SIGTERM shutdown.
- [x] Package scaffolds `engine`, `rulepacks`, `schemas`, `db`, `report`, `config` — each with `package.json`, two tsconfigs, `src/index.ts`, Vitest config and a smoke test.
- [x] `infra/docker-compose.yml`: postgres:16 (init script enabling `pg_trgm` + `pgcrypto`), S3-compatible storage + one-shot bucket creation for `tula`, Mailpit. Healthchecks on all.
- [x] `packages/config`: Zod-validated env + `loadRootEnv()`; `.env.example`.
- [x] GitHub Actions: install → extensions → typecheck → lint → test → build, with a Postgres service container.
- [x] `docs/PROGRESS.md`, `docs/QUESTIONS.md`, `docs/VERSIONS.md`; `CLAUDE.md` + `AGENTS.md` generated from §11.

### Acceptance evidence

```
$ pnpm infra:ps
tula-mailpit    axllent/mailpit:latest       mailpit    Up (healthy)   1025->1025, 8025->8025
tula-postgres   postgres:16-alpine           postgres   Up (healthy)   5433->5432
tula-storage    chrislusf/seaweedfs:latest   storage    Up (healthy)   9000->9000, 9333, 8888

$ docker compose ... up storage-init
tula-storage-init | created bucket tula
tula-storage-init | bucket tula ready

$ docker exec tula-postgres psql -U tula -d tula -tAc "select extname from pg_extension"
pg_trgm, pgcrypto, plpgsql

$ pnpm dev
@tula/web:dev:    - Local: http://localhost:3000   ✓ Ready in 248ms
@tula/worker:dev: INFO (tula-worker): worker ready
$ curl -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:3000/
307 http://localhost:3000/login

$ psql -tAc "select name from pgboss.queue order by name"   # worker created its queues
analytics.refresh, docx.build, notify.email, report.render, report.sign, thumb.make

$ pnpm lint       Checked 63 files. No fixes applied.            (0 errors)
$ pnpm typecheck  Tasks: 14 successful, 14 total
$ pnpm test       Tasks: 14 successful, 14 total  (10 tests, 9 files)
$ pnpm build      Tasks:  8 successful,  8 total
```

## P1 — OIML R 76 engine and rule pack

- [x] `decimal.ts`, `units.ts`: Decimal config (precision 40, half-up), `parseMass`, `formatMass`, unit conversion.
- [x] `types.ts` (§4.2 core types verbatim), `rulepack.ts` (Zod schema + `loadRulepack`/`loadWeightTable`), `packages/rulepacks/data/oiml-r76-1-2006/rulepack.json`, `packages/rulepacks/data/oiml-r111/weights.json`.
- [x] `classification.ts` → `validateInstrument` — every §4.3 rule (e/d form, aux indication, Table 3 bands + n, Min, multi-range/interval ordering, >20% zero-range info issue).
- [x] `mpe.ts` → `mpe`, `mpeBandBoundaries` — single/multi-interval/multi-range, in-service factor.
- [x] `error.ts` → `errorOfIndication`, `correctedError` — change-point and direct methods, all row-validation issues.
- [x] `planner.ts` → `planTests`, `planWeighingLoads`, `planEccentricity`, `planRepeatability`, `planDiscrimination`, `planCreep`, `planTemperatureSequence`.
- [x] `standards.ts` → `decomposeLoad`, `lookupWeightMpe`, `standardsAdequacy`, `substitutionCheck`.
- [x] `tests/*.ts` evaluators + `registry.ts`: all **10 MVP tests** (`EXAM_MARKINGS`, `EXAM_CONSTRUCTION`, `ZERO_ACCURACY`, `WEIGHING`, `ECCENTRICITY`, `DISCRIMINATION`, `REPEATABILITY`, `TEMP_NO_LOAD`, `CREEP`, `ZERO_RETURN`) plus `TARE_ACCURACY`. Remaining 12 catalog codes are fully specified in the rule pack (applicability, clause, params) so `planTests` lists all 24 correctly, but have no evaluator yet — deferred, see `docs/QUESTIONS.md` #12.
- [x] `verdict.ts` → `aggregateEvaluation`; `explain.ts` → `step()` CalcStep builder.
- [x] `packages/schemas`: Zod observation schemas for all 11 implemented test codes, `OBSERVATION_SCHEMA_VERSION = 1`.
- [x] CLI demo: `pnpm --filter @tula/engine demo` prints the §4.5 golden table, computed live.
- [x] `docs/CALCULATION_METHODOLOGY.md` v1, generated from the rule pack by `scripts/gen-methodology.ts` (regenerate, never hand-edit).
- [ ] **Human:** §4.12 constants verification against the OIML PDFs — not done (no network access to oiml.org in this environment). `rulepack.json`'s `verification.verifiedBy/At` stay `null`. **Blocking for production use.**

### Required fixtures — all present and passing

Classification (7 cases + ordering + zero-range + aux-ratio/form), MPE (golden table + boundaries + in-service + multi-interval), error (golden 4-row table + row validation), evaluators (weighing pass/fail/incomplete, eccentricity pass/fail, repeatability at-limit pass + one-step-over fail, discrimination pass/fail, creep 30-min-fail→4h-pass, zero-return boundary, temp-no-load class I vs III), planner (exact golden plan: loads `[100g, 2.5kg, 10kg, 15kg, 30kg]` + 50g zero ref, eccentricity 10kg×5 positions, repeatability 15kg/30kg, discrimination +7g, creep 30kg), standards (F2 20kg+10kg adequate at 460mg vs 2.5g limit; M1 200g inadequate at 10mg vs 3.33mg limit).

### Property tests (fast-check)

mpe non-decreasing with load · in-service = 2×initial · shifting I and L by the same amount leaves E unchanged (both methods) · Dec serialize/parse round-trip · evaluators deterministic.

### Acceptance evidence

```
$ pnpm --filter @tula/engine test -- --coverage
 Test Files  24 passed (24)
      Tests  180 passed (180)

File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
classification.ts  |     100 |      100 |     100 |     100
mpe.ts              |     100 |      100 |     100 |     100
error.ts            |     100 |      100 |     100 |     100
All files          |   99.83 |     97.1 |     100 |   99.81

$ pnpm --filter @tula/engine demo
Tula — OIML R 76-1:2006 engine demo
Rule pack: oiml-r76-1-2006@1.0.0
Zero reference — L=50 g, I=50 g, ΔL=3.0 g → P=49.5 g, E0=-0.5 g
L (g)  I (g)  ΔL (g)  P (g)  E (g)  Ec (g)  mpe (g)  Verdict
10000  10000  1.5     10001  1      1.5     5        PASS
30000  30005  0.5     30007  7      7.5     7.5      PASS
2500   2505   4.5     2503   3      3.5     2.5      FAIL

$ pnpm tsx scripts/check-no-float-mass.ts
check-no-float-mass: OK — scanned 27 files in packages/engine/src, no violations.

$ pnpm tsx scripts/gen-methodology.ts
Wrote docs/CALCULATION_METHODOLOGY.md

$ pnpm typecheck && pnpm lint && pnpm test && pnpm build
Tasks: 14 successful (typecheck), 14 successful (test, 193 total tests across
engine/rulepacks/schemas/web/worker/db/report/config), 8 successful (build).
Lint: 0 errors, 2 info-level style suggestions.
```

## P2 — Database, auth, RBAC and audit ledger

- [x] Drizzle schema for all §5 tables (27 tables across `packages/db/src/schema/{auth,labs,masterdata,equipment,evaluations,reports,rules,audit}.ts`); `drizzle-kit` migrations (`0000` extensions + `uuid_generate_v7()` function, `0001` tables, `0002` audit trigger + `audit_head` seed row, `0003` trigram indexes).
- [x] Better Auth + Drizzle adapter (`packages/db/src/auth-config.ts`, shared by `apps/web/src/server/auth.ts` and `seed.ts`): email + password, `twoFactor` plugin (TOTP), extra `role`/`designation`/`employee_id`/`is_active` user fields; session policy — 30-minute idle timeout native to Better Auth, 8-hour absolute cap enforced separately (`docs/QUESTIONS.md` #15).
- [x] `server/rbac.ts` (§6.2 matrix, `can()`, `permissionsFor()`), `server/action.ts` (Zod parse → session → permission → transaction(handler + audit), `ctx.assertLabAccess()` for lab scope — `docs/QUESTIONS.md` #16), `requireSession()`/`getSession()` in `server/session.ts`, `proxy.ts` route protection (cookie-presence only — see #3, now closed) plus the authoritative gate in `(app)/layout.tsx`.
- [x] `packages/db/src/audit-ledger.ts`: `insertAuditEntry(tx, entry)` (hash chain via `audit_head` row lock) and `verifyChain(db)`; `apps/web/src/server/action.ts` calls the former in the same transaction as every handler. Nightly job registered in the worker: `apps/worker/src/jobs/verify-audit-chain.ts`, scheduled `0 2 * * *` (Asia/Kolkata) via pg-boss, logging a broken id at `error` level. Surfacing the daily head hash on a dashboard and emailing the Controller (§9) is P9/P10 scope.
- [x] Minimal unstyled login page (`(auth)/login`) + TOTP challenge (`(auth)/verify-2fa`) + enrolment page (`(auth)/enroll-2fa`, password re-entry → QR + backup codes → confirm code) for privileged roles; placeholder `(app)/dashboard` so a sign-in has somewhere real to land (P3 replaces it).
- [x] Seed (`packages/db/src/seed.ts`, idempotent): 7 RRSL labs (`docs/QUESTIONS.md` #19) + one user per role in RRSL Bengaluru via `auth.api.signUpEmail` (real password hashing, not hand-rolled), password from `SEED_PASSWORD`.
- [x] `/api/v1/health` (DB `select 1` + S3 `HEAD` reachability).

### Acceptance evidence

Verified against the live dev database and a running `next dev`, both via direct HTTP calls (a real TOTP code computed from the enrolment QR's secret, per RFC 6238) and `psql`:

```
$ pnpm db:generate && pnpm db:migrate && pnpm db:seed
Migrations applied from packages/db/migrations
Labs ready (7 total, RRSL-BLR id=01a0e637-640b-7392-ab08-f2b4eeefdf7b).
Created ADMIN → admin@tula.test
... (one per role) ...
Seed complete.
$ pnpm db:seed   # idempotent — re-running only prints "Already exists ..."

# Each seeded role can sign in (curl, real password, real Origin header):
sign-in as TESTING_OFFICER → 200, GET /dashboard → 200 (no TOTP required)
sign-in as ADMIN → 200 (twoFactorEnabled=false) → GET /dashboard → 307 /enroll-2fa
  → POST /two-factor/enable → totpURI + 10 backup codes
  → POST /two-factor/verify-totp (code computed from the URI's secret) → 200, twoFactorEnabled=true
  → GET /dashboard → 200
  → sign out, sign in again → {"twoFactorRedirect":true} (now correctly challenged)
  → verify-totp again → session restored, role=ADMIN, twoFactorEnabled=true
(admin@tula.test's TOTP was disabled again afterwards, restoring the pristine seed state.)

$ curl -s localhost:3000/api/v1/health
{"status":"ok","checks":{"db":{"status":"ok"},"s3":{"status":"ok"}}}

# UPDATE/DELETE against audit_log, and the tamper-detection test:
$ pnpm --filter @tula/db test
 ✓ chains entries by hash, starting from genesis
 ✓ rejects a plain UPDATE against audit_log
 ✓ rejects a plain DELETE against audit_log
 ✓ verifyChain reports the exact row tampered with by a superuser bypassing the trigger
 ✓ requires trigram search and pgcrypto
 Test Files  2 passed | Tests  5 passed

$ pnpm typecheck && pnpm lint && pnpm test && pnpm build
Tasks: 14 successful (typecheck), 14 successful (test, 229 total tests across
engine/rulepacks/schemas/web/worker/db/report/config), 8 successful (build).
Lint: 0 errors, 2 info-level style suggestions (pre-existing, packages/engine).
```

### Decisions
- 2026-09-28 — Session policy split in two: Better Auth's native `expiresIn`/`updateAge` gives the 30-minute idle timeout; the 8-hour absolute cap is enforced in `server/session.ts` by comparing the session row's immutable `createdAt` against `SESSION_ABSOLUTE_SECONDS` (`docs/QUESTIONS.md` #15).
- 2026-09-28 — `proxy.ts` does a cookie-presence check only (`better-auth/cookies`' `getSessionCookie`); the authoritative session/2FA-enrolment check moved to `(app)/layout.tsx`, which runs as a Server Component in the Node.js runtime. A first attempt at calling `auth.api.getSession` (a real Postgres round trip) directly in `proxy.ts` failed to even bundle under Turbopack — see the next decision and `docs/QUESTIONS.md` #3.
- 2026-09-28 — Found and worked around a Turbopack (Next 16.3.6) resolution bug: a relative import (`./db.js`) from a file compiled into more than one layer (here, `server/auth.ts`, reachable from both a Route Handler and a Server Action chain) fails to resolve — even a brand-new trivial sibling file hit the same error — while the exact same import via the `@/*` path alias works with no other change. Every cross-file import between `apps/web/src/server/*.ts` files now uses the `@/` alias, each with a comment pointing back to this note. Filed as product feedback; not filed as a `docs/QUESTIONS.md` ambiguity because it isn't a spec question, just a tooling workaround future phases need to keep following in this directory.
- 2026-09-28 — uuid v7: Postgres 16 has no built-in `uuidv7()`, so every table's `id` defaults to a hand-written `uuid_generate_v7()` SQL function (`migrations/0000_extensions_and_functions.sql`) instead of an application-side helper — verified against a live database for RFC 9562 version/variant nibbles and monotonic ordering within one millisecond (`docs/QUESTIONS.md` #20).
- 2026-09-28 — Better Auth's Drizzle schema (`user`/`session`/`account`/`verification`/`twoFactor`) is hand-written in `packages/db/src/schema/auth.ts`, not generated via `@better-auth/cli generate` — that CLI's own dependency tree pulls in a conflicting `better-auth@1.4.21` alongside the pinned `1.7.6`. Checked field-for-field against the installed `1.7.6` source instead (see `docs/VERSIONS.md`).
- 2026-09-28 — `action()`'s `AuditSpec` derives `entityId`/`labId`/`diff` from plain functions of the input (and, for `diff`, the handler's result) rather than a fixed shape, so a **denied** attempt (no handler run) can still be audited with whatever the input alone reveals — required for the "forbidden write an audit entry" acceptance criterion, since there is no result to inspect yet.
- 2026-09-28 — Found and fixed a real cross-test-file bug while verifying the above: `apps/web/src/server/action.test.ts`'s cleanup deleted `audit_log` rows but never reset `audit_head` back to `{lastId: null, lastHash: null}`, so a later, separate `pnpm test` invocation (`packages/db`'s own audit-ledger tests) intermittently inherited a stale, non-genesis head and failed a genesis-relative assertion — not a concurrency race (confirmed by direct instrumentation: the two suites never actually overlap in wall time once `turbo.json` orders `@tula/web#test` after `@tula/db#test`), just an incomplete reset. Both test files now reset `audit_head` identically.
- 2026-09-28 — `turbo.json` gives `@tula/db#test` and `@tula/web#test` explicit workspace-scoped configs: `@tula/web#test` now `dependsOn: ["^build", "@tula/db#test"]` (both share the live dev Postgres audit ledger, so they cannot safely run concurrently) and both are `cache: false` (a live external database's state isn't something a content hash should decide is safe to skip re-checking).
- 2026-09-28 — Nightly audit-chain verification lives in `apps/worker` as a new `audit.verify` pg-boss queue, scheduled and worked from `index.ts`; it only logs (info on success, error with the broken id on failure) — the dashboard/email delivery of the daily head hash named in §9 is P9/P10 scope.

### Deviations from implementation.md
- 2026-09-28 — `evaluations.search` (the tsvector `GENERATED` column) indexes `ref_no` only, not "ref_no, model, manufacturer, applicant" as §5's comment describes — a stored generated column can only read columns of the same row, and model/manufacturer/applicant names live on joined tables. `docs/QUESTIONS.md` #18. (§ update: n)
- 2026-09-28 — `reference_weight_sets.cert_attachment_id` has no foreign-key constraint (P4/P6 scope; nothing populates it yet) — `attachments.evaluation_id` isn't nullable per the literal §5 listing, so a calibration certificate not tied to any evaluation doesn't fit that table as specified. `docs/QUESTIONS.md` #17. (§ update: n)
- 2026-09-28 — Route protection (`proxy.ts`) does not do the DB-backed session/role check the P2 task list implies "route protection file" would — it does a cookie-presence check only, with the authoritative check moved to `(app)/layout.tsx`. `docs/QUESTIONS.md` #3. (§ update: y — §2's proxy.ts note should mention this split)

### Follow-ups
- Human: confirm the seven RRSL lab codes (`docs/QUESTIONS.md` #19) match the real network's official codes.
- P4/P6: decide how a lab-equipment calibration certificate attachment fits the schema (`docs/QUESTIONS.md` #17) — loosen `attachments.evaluation_id` to nullable, or give equipment its own attachments table.
- P4/P5/P9: full cross-entity search (model/manufacturer/applicant, not just `ref_no`) needs denormalized snapshot columns or a search view (`docs/QUESTIONS.md` #18).
- P7: enforce the step-up TOTP window (`session.freshAge = 300`, already configured) on tier approvals, seal and revoke.
- P9/P10: surface the daily audit-chain head hash on the dashboard and email it to the Controller as an external anchor (§9); the nightly check itself already runs and logs.

## OIML constants verification (§4.12)
- [ ] Table 3 classification rows (§4.3), including whether Min uses `e` or `d` for auxiliary indication — see `docs/QUESTIONS.md` #8
- [ ] Table 6 MPE bands (§4.4) and in-service factor
- [ ] Multi-interval and multi-range MPE computation
- [ ] Auxiliary indicating device rules
- [ ] Zero-setting ranges, zero-setting accuracy, zero-tracking rate
- [ ] Repeatability readings per series and load points — see `docs/QUESTIONS.md` #11
- [ ] Eccentricity loads and positions
- [ ] Tilting limits and criteria
- [ ] Warm-up criteria and reading times
- [ ] Temperature stability limits; static temperature sequence
- [ ] Damp heat class applicability and duration
- [ ] Creep / zero return values; class applicability
- [ ] Durability criterion and applicability
- [ ] Disturbance test levels and the significant-fault definition
- [ ] Span stability criterion and schedule
- [ ] R 111 weight MPE table values (§4.8)
- [ ] R 76-2:2007 section order for the report (§8.1)

Not started — every constant above was transcribed directly from implementation.md
§4.3/§4.4/§4.6/§4.8 (itself transcribed from the OIML PDFs), never invented, but
this environment has no network access to oiml.org to check the transcription
against the source. **A human must complete this checklist and set
`verification.verifiedBy`/`verifiedAt` in `packages/rulepacks/data/oiml-r76-1-2006/rulepack.json`
before this is used to certify a real instrument.**

## Decisions
- 2026-09-27 — Shared packages build with `tsc -p tsconfig.build.json` instead of `tsup` — tsup's bundled `rollup-plugin-dts` crashes under TypeScript 7; the compiler that typechecks the code now also emits its declarations, and the workspace carries one fewer dependency.
- 2026-09-27 — Every package exports a `default` condition alongside `import`, because Next.js loads `next.config.ts` through a CJS loader and an ESM-only `exports` map makes it unresolvable.
- 2026-09-27 — Added **dotenv 18.0.4** to `@tula/config` (new dependency, reason logged per §11): Next.js reads `.env` only from its own app directory and the worker reads none at all, so `loadRootEnv()` gives the whole workspace one root `.env` while letting shell and Compose values win.
- 2026-09-27 — Compose host ports are variables (`${POSTGRES_PORT:-5432}`, `${S3_PORT:-9000}`, `${SMTP_PORT:-1025}`) with the spec's defaults, so the stack coexists with services already running on a developer's machine.
- 2026-09-27 — `tsconfig.base.json` sets `types: ["node"]` explicitly; TypeScript 7 did not pick up `@types/node` from pnpm's nested layout on its own.
- 2026-09-28 — The §7.2 token block and the `@theme inline` mapping landed in `globals.css` during P0 rather than P3, so even the placeholder login screen contains no raw hex (§11, UI rules).
- 2026-09-28 — `engine.loadRulepack(raw: unknown)` validates an in-memory value rather than reading a file — the engine has zero I/O by design (§3.2), so `@tula/rulepacks` does the actual file read and calls this validator (docs/QUESTIONS.md #9).
- 2026-09-28 — `mpe()` never checks whether a load is within the instrument's declared range; `LOAD_OUT_OF_RANGE` is raised by the evaluators (`tests/shared.ts`), not by the MPE lookup itself (docs/QUESTIONS.md #10).
- 2026-09-28 — `CLS_MIN_LOW` always uses the first range's `e` (never `d`) even under auxiliary indication, per Table 3's literal wording (docs/QUESTIONS.md #8).
- 2026-09-28 — REPEATABILITY's required-reading-count threshold compares the **instrument's** Max, not the series' own load, against `maxLoadKgForTenReadings` — matches `planner.ts`'s existing behaviour and the field's name (docs/QUESTIONS.md #11).
- 2026-09-28 — CREEP's "scheduled reading missing" issue is `error` severity (blocks to INCOMPLETE), not `warning` — a partial 30-minute series should never silently roll up to a misleading PASS via row verdicts alone.
- 2026-09-28 — Engine test fixtures (`packages/engine/src/__fixtures__/rulepack.ts`) carry their own copy of the rule pack JSON rather than importing `@tula/rulepacks`, because the engine must stay free of internal package imports even in its own test suite (`rulepacks` depends on `engine`, not the reverse). Keep the two in sync by hand; `@tula/rulepacks`' own tests guard the real file independently.
- 2026-09-28 — Re-verified P1's acceptance evidence: `src/demo.ts` (a CLI script, same category as the already-excluded `src/index.ts`) was missing from `vitest.config.ts`'s coverage `exclude`, so a plain `vitest run --coverage` scored 95.82%/95.57%/96.87%/96.1% instead of the 99.83%/97.08%/100%/99.81% recorded below — the untested demo script, not an engine regression, was dragging the summary down. Added `src/demo.ts` to the exclude list; the coverage command now reproduces the recorded numbers exactly. All other P1 evidence (typecheck, lint, test, build, `check-no-float-mass`, the demo output, and `gen-methodology` producing no diff) re-ran clean and unchanged.

## Deviations from implementation.md
- 2026-09-27 — **Object storage is SeaweedFS, not MinIO** (`infra/docker-compose.yml`) — MinIO's images are no longer publicly pullable (Docker Hub and quay.io both 401). Same S3 API, same port, same credentials; no application code differs. §2 not yet updated pending the human decision in `docs/QUESTIONS.md` #4. (§ update: n)
- 2026-09-27 — **No `tsup`** anywhere; packages build with `tsc`. §10 P0 named tsup for `apps/worker`. (§ update: n)
- 2026-09-27 — Postgres is published on **5433** on this machine only (root `.env`); the committed default stays 5432. (§ update: n)
- 2026-09-28 — Rule-pack data files live at `packages/rulepacks/data/oiml-r76-1-2006/rulepack.json` and `packages/rulepacks/data/oiml-r111/weights.json` — one level deeper than §4.8's literal `packages/rulepacks/oiml-r111/weights.json`, so `data/` stays a sibling of both `src/` and `dist/` and the runtime lookup path is identical whichever one is running (docs/QUESTIONS.md #13). (§ update: n)
- 2026-09-28 — Only 11 of the 24 catalog test evaluators are implemented (the 10 MVP tests + `TARE_ACCURACY`); the rule pack still lists and correctly gates all 24 for `planTests`. §10 P1's task list implies "all MVP tests... then the rest" within the phase — the remaining 12 are deferred as follow-up work (docs/QUESTIONS.md #12). (§ update: n, tracked as a follow-up instead)

## Follow-ups
- Decide the production object-storage story before P12 (QUESTIONS #4).
- Self-host IBM Plex Sans / Mono / Sans Devanagari in P3 — `globals.css` currently falls back to the system stack with a `TODO(P3)`.
- Complete §4.12 OIML constants verification against the source PDFs — human task, currently blocked on network access to oiml.org (QUESTIONS #8, #11).
- Implement the remaining 12 evaluators (`ZERO_RANGE`, `ZERO_TRACKING`, `WEIGHING_SUPPL`, `WEIGHING_TARE`, `TILTING`, `WARM_UP`, `TEMP_STATIC`, `DAMP_HEAT`, `POWER_SUPPLY`, `DURABILITY`, `DISTURBANCES`, `SPAN_STABILITY`) and their observation schemas; `MODULE_COMPAT` is explicitly a stretch goal per §4.6 and can wait longest.
- Add `test:e2e` implementations in P6 when Playwright arrives; the turbo task exists but no package defines the script yet.
