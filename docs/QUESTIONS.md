# Tula — open questions

Ambiguities and blockers found while building. Rule: choose the conservative option,
record it here, continue (implementation.md §0). Resolve with the human owner between
phases.

| # | Phase | Question | Conservative choice made | Status |
|---|---|---|---|---|
| 1 | P0 | `.nvmrc` pins Node 22 LTS, but the machine used for P0 runs Node 26. | `.nvmrc` stays at 22 as specified and CI builds on it; `engines.node` is `>=22` so Node 26 also runs. | Open |
| 2 | P0 | §2 says "latest stable of everything", which now means TypeScript 7 (the native compiler) and Vitest 5 — both very recent majors. | Installed latest stable as instructed, pinned exactly in `docs/VERSIONS.md`. Everything green so far. Fall back to TypeScript 5.9 / Vitest 3 only if a toolchain incompatibility appears that cannot be worked around. | Open |
| 3 | P0 | §2 notes route protection lives in `middleware.ts` (Next ≤ 15) or `proxy.ts` (Next 16+). Installed Next is 16.3.6. | P2 will put route protection in `apps/web/src/proxy.ts`. | Open |
| 4 | P0 | §2 specifies **MinIO** for dev/on-prem object storage, but MinIO's container images are no longer publicly pullable — `minio/minio`, `minio/mc` (Docker Hub) and `quay.io/minio/*` all answer 401/"pull access denied". | Dev object storage runs **SeaweedFS** (`chrislusf/seaweedfs`), which serves the same S3 API on the same port with the same credentials. No application code is affected: everything goes through `@aws-sdk/client-s3` against `S3_ENDPOINT`. **Needs a human decision** before P12: SeaweedFS for on-prem too, a licensed MinIO, or AWS S3. | Open |
| 5 | P0 | §10 P0 uses `tsup` to build the shared packages, but tsup's bundled `rollup-plugin-dts` crashes against TypeScript 7 (`Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`). | Packages build with plain `tsc -p tsconfig.build.json` instead — one fewer dependency, and declarations come from the compiler that typechecks them. `tsup` was removed from every package. | Closed |
| 6 | P0 | Next.js only reads `.env` from its own app directory, so a monorepo-root `.env` would not reach `apps/web`, and pg-boss in `apps/worker` gets no `.env` loading at all. | One `.env` at the repository root is the single source of truth; `@tula/config` exports `loadRootEnv()`, called from `apps/web/next.config.ts` and at the top of the worker. Shell and Compose values always win over the file. Added `dotenv` for this (reason logged in PROGRESS.md). | Closed |
| 7 | P0 | The development machine already runs a native PostgreSQL on 127.0.0.1:5432, which shadows the container's published port. | Compose host ports are variables with the spec's defaults (`${POSTGRES_PORT:-5432}` etc.). This machine's `.env` publishes Postgres on 5433 and points `DATABASE_URL` at it; other machines see 5432 unchanged. | Closed |
