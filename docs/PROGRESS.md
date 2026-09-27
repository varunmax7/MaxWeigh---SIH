# Tula — progress log

| Phase | Status | Started | Finished | Evidence |
|---|---|---|---|---|
| P0 Foundation | ☑ | 2026-09-27 | 2026-09-28 | command output below |
| P1 Engine | ☑ | 2026-09-28 | 2026-09-28 | coverage report + demo output below |
| P2 Core | ☐ | | | |
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
