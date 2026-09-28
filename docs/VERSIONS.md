# Tula — installed versions

Pinned in P0 and **not upgraded mid-project** (implementation.md §2, version policy).
Every dependency is pinned exactly — no `^`, no `~` — so a rebuild months from now
produces the same binary behaviour a certificate was issued under.

## Toolchain

| Tool | Version |
|---|---|
| Node.js (`.nvmrc`, CI) | 22 LTS |
| Node.js (dev machine used for P0) | 26.7.0 |
| pnpm | 10.34.5 |
| TypeScript | 7.0.2 |
| Turborepo | 2.11.4 |
| Biome | 2.5.14 |
| Vitest | 5.0.2 |
| tsx | 4.23.13 |
| fast-check | 4.10.2 |
| @vitest/coverage-v8 | 5.0.2 |

## Application dependencies

| Package | Version | Used by |
|---|---|---|
| next | 16.3.6 | apps/web |
| react / react-dom | 19.3.0 | apps/web |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | apps/web |
| decimal.js | 10.6.0 | packages/engine |
| zod | 4.6.5 | packages/engine, schemas, config, **apps/web** |
| drizzle-orm | 0.45.3 | packages/db, **apps/web** |
| postgres | 3.4.9 | packages/db |
| dotenv | 18.0.4 | packages/config |
| pg-boss | 12.35.0 | apps/worker |
| pino / pino-pretty | 10.3.1 / 13.1.3 | apps/worker |
| drizzle-kit | 0.31.11 | packages/db (devDependency; `db:generate`) |
| better-auth | 1.7.6 | packages/db (shared config + seed), apps/web |
| canonicalize | 5.1.0 | packages/db (audit ledger hash chain, §9) |
| qrcode | 1.5.4 | apps/web (TOTP enrolment QR) |

`tsx` is also a root devDependency, used to run `scripts/check-no-float-mass.ts`
and `scripts/gen-methodology.ts`, and (P2) a devDependency of `packages/db` for
`db:migrate`/`db:seed`. The root `package.json` additionally depends
on `@tula/engine` and `@tula/rulepacks` (workspace) so the methodology
generator can import them; `fast-check` and `@vitest/coverage-v8` are
devDependencies of `packages/engine` only.

`@better-auth/cli` (the schema generator) was deliberately **not** installed:
its own dependency tree pulls in an older `better-auth@1.4.21` alongside the
pinned `1.7.6`, and its generated Drizzle schema output could not be trusted
to match a rule pack + TOTP plugin combination it wasn't resolving against.
The Drizzle schema for `user`/`session`/`account`/`verification`/`twoFactor`
in `packages/db/src/schema/auth.ts` was hand-written instead, checked
field-for-field against the installed `better-auth@1.7.6` source.

## Infrastructure images

| Service | Image | Note |
|---|---|---|
| PostgreSQL | postgres:16-alpine | `pg_trgm` + `pgcrypto` enabled by `infra/postgres/init.sql` |
| Object storage (S3 API) | chrislusf/seaweedfs:latest | Substitutes for MinIO, whose images are no longer public — see `docs/QUESTIONS.md` #4 |
| SMTP (dev) | axllent/mailpit:latest | UI on http://localhost:8025 |

Added later (recorded when the phase installs them): shadcn/ui +
Radix + lucide-react (P3), TanStack Table, Recharts, nuqs, cmdk, sonner (P3–P9),
Playwright, `docx`, `@signpdf/*`, `sharp` (P8),
`@aws-sdk/client-s3` (P6), `fast-check` (P1).

Deliberately **not** installed: `tsup` (TypeScript 7 incompatibility — packages build with
`tsc`, see `docs/QUESTIONS.md` #5).
