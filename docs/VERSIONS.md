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
| canonicalize | 5.1.0 | packages/db (audit ledger hash chain, §9), packages/report (`model_sha256`, §6.3, P7) |
| qrcode | 1.5.4 | apps/web (TOTP enrolment QR) |
| shadcn | 4.21.0 | apps/web (component source generator; also a runtime import, `shadcn/tailwind.css`) |
| radix-ui | 1.6.7 | apps/web (Radix's single consolidated package — the shadcn CLI's current default, not per-primitive `@radix-ui/react-*`) |
| @base-ui/react | 1.8.0 | apps/web (Base UI — this shadcn version's Combobox is built on it, not Radix) |
| class-variance-authority | 0.7.1 | apps/web (`ui/` variant classnames) |
| cn | 0.4.0 | apps/web (`clsx` + `tailwind-merge`, generated as `src/lib/utils.ts`'s `cn`) |
| lucide-react | 1.48.0 | apps/web (icons) |
| tw-animate-css | 1.4.0 | apps/web (Tailwind v4 animation utilities the generated components use) |
| next-themes | 0.4.6 | apps/web (pinned to `defaultTheme="light"`, `enableSystem={false}` — no toggle built in P3, see `app/layout.tsx`) |
| sonner | 2.0.8 | apps/web (toast, §7.6) |
| cmdk | 1.1.1 | apps/web (⌘K command palette, §7.4) |
| @fontsource/ibm-plex-sans, -mono, -sans-devanagari | 5.3.0 | apps/web (self-hosted per-weight `@import`s in `globals.css`, §7.3) |
| @playwright/test | 1.63.0 | apps/web (devDependency; `test:e2e`, §10 P3) |
| @axe-core/playwright | 4.13.0 | apps/web (devDependency; the `/login` + `/dev/ui` accessibility check) |
| @tanstack/react-table | 9.2.4 | apps/web (P4: Instruments list/search tables) |
| file-type | 22.1.1 | apps/web (P4: magic-byte MIME check on upload, §9) |
| @aws-sdk/client-s3, @aws-sdk/s3-request-presigner | 3.1141.0 | apps/web, apps/worker (P4: `/api/v1/files`, thumbnail worker job) |
| sharp | 0.35.5 | apps/worker (P4: `thumb.make` job) |
| nuqs | 2.10.1 | apps/web (P5: `/evaluations` list filters, §7.5) |
| playwright | 1.63.0 | apps/worker (P8: `report.render`, real dependency now — not just `@playwright/test`'s transitive copy) |
| docx | 9.8.1 | packages/report (P8: the DOCX builder) |
| @signpdf/signpdf, @signpdf/signer-p12, @signpdf/placeholder-plain | 3.3.0 | apps/worker (P8: `report.sign`, PAdES) |
| jszip | 3.10.1 | packages/report (devDependency; P8's DOCX structural test — no LibreOffice in this environment, see docs/PROGRESS.md P8 Deviations) |

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

Added later (recorded when the phase installs them, now in the table above):
TanStack Table, `file-type`, `@aws-sdk/client-s3`/`s3-request-presigner`, `sharp`
(all P4), `nuqs` (P5), `fast-check` (P1), `playwright`/`docx`/`@signpdf/*`/`jszip`
(P8). `react`/`react-dom` were also added to `packages/report` (P8: the print
components are real `.tsx`, not just data). Still to come: Recharts (P9).

Playwright's browser binary (Chromium only) is installed separately via
`npx playwright install --with-deps chromium` — not tracked by `pnpm-lock.yaml`,
so a fresh clone needs that command once before `test:e2e` can run.

Deliberately **not** installed: `tsup` (TypeScript 7 incompatibility — packages build with
`tsc`, see `docs/QUESTIONS.md` #5).
