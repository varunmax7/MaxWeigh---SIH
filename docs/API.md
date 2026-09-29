# Tula — sensor, serial and verification APIs

implementation.md §10 P10's "documented in `docs/API.md`" task. Covers the
device-facing environment sensor API, the workspace's SSE stream, and the
Web Serial "Read from instrument" client-side integration — the three
non-`action()` surfaces added in P10. `POST /api/v1/reports/export` and
`/verify/[certNo]` predate this file and aren't repeated here.

## Environment sensors

### `POST /api/v1/env/readings`

Device-facing ingest. Not session-authenticated — a lab hub posting this has
no user login of its own; the device key **is** its credential and its lab
scope.

```
POST /api/v1/env/readings
Authorization: Bearer <device key>
Content-Type: application/json

{ "tempC": 22.4, "rhPct": 54.1, "pressureHpa": 1013.2, "ts": "2026-09-29T12:00:00.000Z" }
```

- `ts` is optional; the server uses its own receipt time if omitted.
- The device key is issued once by **Instruments → Reference equipment →
  Register sensor** (`registerEnvSensorAction`, P4) and shown exactly once —
  it is stored only as a SHA-256 hash (`env_sensors.device_key_hash`), the
  same way session tokens and share-link tokens are.
- **Rate limit**: a sensor may post at most once every 2 seconds
  (`MIN_INGEST_INTERVAL_MS`, `apps/web/src/server/env-ingest.ts`), checked
  against that sensor's own most recent row in `env_readings` — no shared
  cache needed, so it holds under a multi-instance deployment. This is a
  narrow, per-device-key limiter, not a general abuse limiter; a broader
  one (per-IP, across every route) is P11 scope (`docs/QUESTIONS.md` #38).
- Responses: `200 { ok: true, data: { id } }` · `401` unknown/retired device
  key · `400 { ok: false, code: "VALIDATION", issues }` bad payload ·
  `429 { ok: false, code: "RULE" }` rate limited.

`scripts/sim-env.ts` is a reference client: `pnpm sim:env [--lab RRSL-BLR]
[--interval-ms 10000]`. It registers its own sensor on first run (cached at
`tmp/sim-env-<labCode>.json`, gitignored) and posts real HTTP requests
against a running dev server with a slow random walk around 22 °C / 54 % RH
/ 1013 hPa. Stop it with Ctrl+C to see the workspace's "Sensor offline" state
appear within 2 minutes.

### `GET /api/v1/env/stream?lab=<labId>`

Session-authenticated Server-Sent Events stream of a lab's latest reading —
read by the test execution workspace, not by a sensor. Requires the visitor
to be a member of `lab`.

```
event: reading
data: {"sensorId":"...","hubCode":"SIM-RRSL-BLR","tempC":22.4,"rhPct":54.1,"pressureHpa":1013.2,"ts":"..."}

event: heartbeat
data: {"lastSensorId":"..."}
```

- Polls `env_readings` every 2 s server-side and only emits a `reading`
  event when the latest row actually changed; a `heartbeat` event every
  ~30 s otherwise, to keep the connection visibly alive through proxies.
- The client (`useEnvStream`, `apps/web/src/components/workspace/`) derives
  **live** (≤ 30 s old) / **stale** (30 s–2 min) / **offline** (> 2 min) from
  the last reading's age on its own 5 s timer — see
  `apps/web/src/lib/sensor-status.ts` — so staleness advances even while no
  new SSE event arrives.

## Web Serial — "Read from instrument"

Chromium-only (`navigator.serial`); the workspace's panel shows a plain
"not supported" message in other browsers rather than failing silently, and
offers **Mock mode** as a hardware-free fallback either way.

### Parser profiles

A parser profile turns one line of decoded serial text into `{ value, unit,
stable }`. These are **best-effort default conventions**, not a copied
vendor spec — this environment has no way to verify a specific indicator's
real protocol against its manual. `packages/schemas`-style "log the
assumption, don't invent silently" applies here too (`docs/QUESTIONS.md`).

| id | Format | Example |
|---|---|---|
| `and-style` | `ST\|US\|OL,±value,unit` (A&D FX/FZ/GX-style continuous output) | `ST,+00123.45,g` |
| `generic-csv` | `value,unit,stable\|unstable` | `12.345,kg,stable` |
| `custom` | Any regex with named groups `value`, `unit`, `stable?` | user-supplied |

Source: `apps/web/src/lib/serial/parsers.ts` (pure, unit-tested — no
`navigator.serial` dependency, so profiles can be tested without a browser).

### Connecting

`SerialReadPanel` (`apps/web/src/components/workspace/`) → **Read from
instrument** → pick a profile and baud rate → **Connect** opens Chrome's
native port picker. Once connected, each parsed line updates the panel's
"last reading"; **Insert into focused field** writes that value into
whichever measurement input currently has focus — every grid cell and
single-value input in the workspace carries `data-serial-target="true"` for
this (`apps/web/src/lib/serial/insert-into-focused-input.ts`). Disconnecting
(unplugging, or the **Disconnect** button) is handled the same way either
way — the panel returns to its idle state, nothing is left half-open.

### Mock mode (no hardware)

**Mock mode** in the same panel accepts a typed value + unit and a
**Simulate stable reading** button — useful for demoing or testing the
insert-into-focused-field flow with nothing plugged in. Covered by
`apps/web/src/lib/serial/parsers.test.ts` (parsing) and the panel's own
mock-mode state machine.

### `scripts/sim-serial.ts` (real end-to-end test, optional)

Node can't itself appear as a USB serial device to
`navigator.serial.requestPort()` — that only ever lists real or
OS-virtualized ports from a native chooser. To exercise the real Web Serial
code path without hardware:

```
socat -d -d pty,raw,echo=0,link=/tmp/tula-sim-a pty,raw,echo=0,link=/tmp/tula-sim-b
pnpm tsx scripts/sim-serial.ts --out /tmp/tula-sim-a --profile and-style
```

Then in Chrome, **Connect** → choose the port corresponding to
`/tmp/tula-sim-b` from the picker. With no `--out`, the script just prints
lines to stdout, which is what the table above's examples came from
(`pnpm tsx scripts/sim-serial.ts --profile generic-csv`).

## Manual verification checklist

`claude-in-chrome` browser automation has been unavailable in this build
environment since P4 (see every phase's docs/PROGRESS.md); Web Serial
specifically also needs a real port-picker permission prompt no automation
tool can drive. Verified instead by:

- `POST /api/v1/env/readings`: real curl round trip — valid key accepted,
  wrong key `401`, second request inside 2 s rejected `429` (`docs/PROGRESS.md`).
- `scripts/sim-env.ts` run against the real dev server: rows land in
  `env_readings` with the correct sensor/lab, visible via `psql`.
- `GET /api/v1/env/stream`: exercised via `EventSource` from a small Node
  script hitting the running dev server with a session cookie captured from
  a real sign-in, confirming `reading` events and the 2-minute-offline
  timing.
- Web Serial itself: code-reviewed and unit-tested (parsers, mock-mode
  state machine, `insertIntoFocusedInput`'s native-setter technique against
  jsdom); the real port picker and a physical/virtual serial device need a
  human at a real Chrome window — steps above are what to run.
