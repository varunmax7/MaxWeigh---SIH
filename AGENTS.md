<!-- Generated from implementation.md §11. Update both together. -->

# Tula — agent rules (binding)

## Scope
- implementation.md is the source of truth. Work on one phase at a time; never start the next phase unprompted.
- Before coding, read the sections named in the kickoff prompt + docs/PROGRESS.md + docs/QUESTIONS.md.
- Ambiguity: choose the conservative option, log it in docs/QUESTIONS.md, continue.

## Correctness (non-negotiable)
- All OIML logic lives in packages/engine. UI and server code call it; they never re-implement a rule.
- Masses and errors are Decimal (decimal.js) internally and strings at boundaries. Never JS number arithmetic on masses.
- Never invent OIML constants. Constants come only from the rule pack. Unknowns get `TODO(verify-oiml)` + a QUESTIONS.md line.
- Limit comparisons are inclusive and happen before any display rounding.
- The server engine result is authoritative and is persisted with engineVersion and rulepack id@version.
- Evaluations snapshot spec, rule pack and standards. Never mutate a snapshot; create a new version.

## Server code
- Every mutation uses the action() wrapper: Zod parse → session → permission → lab scope → transaction(handler + audit).
- Every state change writes an audit entry in the same transaction. audit_log is append-only.
- Every read query is scoped to the user's labs.
- No external network calls at runtime (fonts self-hosted, no CDNs, no third-party APIs).

## UI
- Use design tokens only; no raw hex outside globals.css. Sentence-case labels.
- Monospace only for measurements, IDs, clause numbers, hashes. Brass (--seal) only for sealed/signed/VALID.
- Status = icon + text + colour. Keyboard operable. Visible focus. aria-live for autosave and verdict changes.
- Copy: buttons say what happens; the toast uses the same verb; errors say what's wrong and how to fix it.
- Do not paste OIML normative text into the UI; paraphrase and cite the clause.

## Code quality
- TypeScript strict; no `any` (use `unknown` + narrowing); no non-null assertions on external data.
- Files ≤ 400 lines; colocate component, test, and schema where practical.
- Do not add or upgrade dependencies without recording the reason in docs/PROGRESS.md.
- Before every commit: pnpm typecheck && pnpm lint && pnpm test (and relevant e2e) must pass.
- Conventional commits. One phase = one or more focused commits ending with the phase commit message.

## Done means
- Every Acceptance criterion of the phase is demonstrably met (test output, screenshot path, or command output in PROGRESS.md).
- docs/PROGRESS.md updated: tasks ticked, decisions, deviations, follow-ups.
