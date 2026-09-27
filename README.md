# Tula — OIML R 76 NAWI type-evaluation and test report system

Type evaluation and test reporting for non-automatic weighing instruments under
**OIML R 76-1:2006**, for Legal Metrology laboratories. SIH PS 26035.

`implementation.md` is the source of truth for scope, data model, rules and phases.
`CLAUDE.md` / `AGENTS.md` hold the binding agent rules (§11). Build state lives in
`docs/PROGRESS.md`; open decisions in `docs/QUESTIONS.md`.

## Getting started

```bash
cp .env.example .env          # then set AUTH_SECRET and PRINT_TOKEN_SECRET
#   openssl rand -hex 32
pnpm install
pnpm infra:up                 # postgres, S3-compatible storage, mailpit
pnpm dev                      # web on :3000, worker consuming pg-boss queues
```

If something already listens on 5432, 9000 or 1025, change `POSTGRES_PORT`,
`S3_PORT` or `SMTP_PORT` in `.env` and point `DATABASE_URL`, `S3_ENDPOINT` and
`SMTP_URL` at the same numbers.

| Service | Where |
|---|---|
| Web app | http://localhost:3000 |
| Mail (Mailpit) | http://localhost:8025 |
| Object storage (S3 API) | http://localhost:9000, bucket `tula` |
| Postgres | `DATABASE_URL` in `.env` |

## Quality gates

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All four must pass before any commit (§11). CI runs the same sequence with a
Postgres service container.

## Layout

```
apps/web       Next.js App Router — UI, server actions, print route, public verify page
apps/worker    pg-boss consumers — report render/sign, DOCX, thumbnails, analytics, email
packages/engine     pure OIML R 76 calculation engine (no I/O, no internal imports)
packages/rulepacks  versioned OIML rule packs as data
packages/schemas    Zod schemas shared by client and server
packages/db         Drizzle schema, migrations, SQL, seed
packages/report     ReportModel builder, print components, DOCX builder
packages/config     Zod-validated environment
infra          docker-compose and deployment assets
docs           progress, questions, versions, architecture, methodology
```

Dependency direction: `engine` ← `rulepacks` ← `schemas` ← `db`, `report` ← `web`, `worker`.
The engine imports nothing internal and performs no I/O.

## On-prem by design

No runtime call leaves the machine: self-hosted auth, self-hosted fonts, no CDN,
no third-party API. The whole stack runs on a lab LAN or an air-gapped VM.
