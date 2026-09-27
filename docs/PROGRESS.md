# Tula — progress log

| Phase | Status | Started | Finished | Evidence |
|---|---|---|---|---|
| P0 Foundation | ☑ | 2026-09-27 | 2026-09-28 | command output below |
| P1 Engine | ☐ | | | coverage report path, demo output |
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

## OIML constants verification (§4.12)
Not started — human task, due in P1.

## Decisions
- 2026-09-27 — Shared packages build with `tsc -p tsconfig.build.json` instead of `tsup` — tsup's bundled `rollup-plugin-dts` crashes under TypeScript 7; the compiler that typechecks the code now also emits its declarations, and the workspace carries one fewer dependency.
- 2026-09-27 — Every package exports a `default` condition alongside `import`, because Next.js loads `next.config.ts` through a CJS loader and an ESM-only `exports` map makes it unresolvable.
- 2026-09-27 — Added **dotenv 18.0.4** to `@tula/config` (new dependency, reason logged per §11): Next.js reads `.env` only from its own app directory and the worker reads none at all, so `loadRootEnv()` gives the whole workspace one root `.env` while letting shell and Compose values win.
- 2026-09-27 — Compose host ports are variables (`${POSTGRES_PORT:-5432}`, `${S3_PORT:-9000}`, `${SMTP_PORT:-1025}`) with the spec's defaults, so the stack coexists with services already running on a developer's machine.
- 2026-09-27 — `tsconfig.base.json` sets `types: ["node"]` explicitly; TypeScript 7 did not pick up `@types/node` from pnpm's nested layout on its own.
- 2026-09-28 — The §7.2 token block and the `@theme inline` mapping landed in `globals.css` during P0 rather than P3, so even the placeholder login screen contains no raw hex (§11, UI rules).

## Deviations from implementation.md
- 2026-09-27 — **Object storage is SeaweedFS, not MinIO** (`infra/docker-compose.yml`) — MinIO's images are no longer publicly pullable (Docker Hub and quay.io both 401). Same S3 API, same port, same credentials; no application code differs. §2 not yet updated pending the human decision in `docs/QUESTIONS.md` #4. (§ update: n)
- 2026-09-27 — **No `tsup`** anywhere; packages build with `tsc`. §10 P0 named tsup for `apps/worker`. (§ update: n)
- 2026-09-27 — Postgres is published on **5433** on this machine only (root `.env`); the committed default stays 5432. (§ update: n)

## Follow-ups
- Decide the production object-storage story before P12 (QUESTIONS #4).
- Self-host IBM Plex Sans / Mono / Sans Devanagari in P3 — `globals.css` currently falls back to the system stack with a `TODO(P3)`.
- P1 adds `scripts/check-no-float-mass.ts`, `scripts/gen-methodology.ts` and the `fast-check` property tests.
- Add `test:e2e` implementations in P6 when Playwright arrives; the turbo task exists but no package defines the script yet.
