/**
 * §8.1 item 6/7: one detailed test sheet per test — start/end conditions,
 * the recorded observations, the engine's computed rows, the verdict, and
 * (where the row carries a load) the error envelope chart.
 */
import type { ReportModelTest } from '@tula/schemas';
import { EnvelopeSvg } from './EnvelopeSvg.js';
import { fmtDateTime, fmtDec, verdictLabel } from './format.js';

/**
 * `WeighingRowInput.rowId` gets prefixed `asc-`/`desc-` by the engine's own
 * `toLoadRow` (`packages/engine/src/tests/weighing.ts`) so the two arrays'
 * ids can never collide in one `RowResult[]` — the only place this matters,
 * since it's the one place a *stored* `rowId` differs from what the tester
 * actually typed.
 */
const KNOWN_ROW_PREFIXES: Record<string, string> = {
  ascending: 'asc-',
  descending: 'desc-',
};

/**
 * Best-effort: finds every `{ rowId, L }` pair inside an observation payload
 * whose test code prefixes rows the same way WEIGHING does, so the
 * envelope chart (which needs a load to place a point on its x-axis) has
 * something to plot for the one test §7.1 built the chart around. Test
 * codes whose rows carry no `L` next to their `rowId` at all (ECCENTRICITY's
 * `position`, REPEATABILITY's per-series `L` one level up) — or whose id
 * prefix isn't one of `KNOWN_ROW_PREFIXES` — simply contribute nothing; the
 * numeric table above is complete regardless, only the chart goes without.
 */
function loadByRowId(value: unknown, out: Map<string, string>, prefix = ''): void {
  if (Array.isArray(value)) {
    for (const item of value) loadByRowId(item, out, prefix);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.rowId === 'string' && typeof record.L === 'string') {
    out.set(`${prefix}${record.rowId}`, record.L);
  }
  for (const [key, nested] of Object.entries(record)) {
    loadByRowId(nested, out, KNOWN_ROW_PREFIXES[key] ?? prefix);
  }
}

function formatEnvConditions(env: Record<string, unknown> | null): string {
  if (!env) return '—';
  const temp = typeof env.tempC === 'number' ? `${env.tempC} °C` : null;
  const rh = typeof env.rhPct === 'number' ? `${env.rhPct} %RH` : null;
  return [temp, rh].filter(Boolean).join(' · ') || '—';
}

export function TestSheet({ test }: { test: ReportModelTest }) {
  const rows = test.result?.rows ?? [];
  const loads = new Map<string, string>();
  loadByRowId(test.observations, loads);
  const points = rows.flatMap((row) => {
    const l = loads.get(row.rowId);
    if (!l || !row.Ec || !row.mpe) return [];
    return [{ rowId: row.rowId, L: Number(l), Ec: Number(row.Ec), mpe: Number(row.mpe) }];
  });

  return (
    <section className="avoid-break page-break-before">
      <h2 style={{ fontSize: '13pt' }}>
        {test.title ?? test.testCode}
        {test.rangeIndex > 0 ? ` — range ${test.rangeIndex + 1}` : ''}
        {test.clause ? (
          <span className="tabular" style={{ fontWeight: 400, fontSize: '10pt' }}>
            {' '}
            · clause {test.clause}
          </span>
        ) : null}
      </h2>

      {test.applicability === 'NOT_APPLICABLE' ? (
        <p>Not applicable{test.naReason ? ` — ${test.naReason}` : ''}.</p>
      ) : (
        <>
          <table>
            <tbody>
              <tr>
                <td>Start conditions</td>
                <td>{formatEnvConditions(test.envStart)}</td>
                <td>End conditions</td>
                <td>{formatEnvConditions(test.envEnd)}</td>
              </tr>
              <tr>
                <td>Completed</td>
                <td>{fmtDateTime(test.completedAt)}</td>
                <td>By</td>
                <td>{test.completedByName ?? '—'}</td>
              </tr>
            </tbody>
          </table>

          {rows.length > 0 ? (
            <table style={{ marginTop: '3mm' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Row</th>
                  <th style={{ textAlign: 'right' }}>P</th>
                  <th style={{ textAlign: 'right' }}>E</th>
                  <th style={{ textAlign: 'right' }}>Ec</th>
                  <th style={{ textAlign: 'right' }}>Ec / e</th>
                  <th style={{ textAlign: 'right' }}>MPE</th>
                  <th style={{ textAlign: 'left' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowId}>
                    <td className="mono">{row.rowId}</td>
                    <td className="tabular" style={{ textAlign: 'right' }}>
                      {row.P ? fmtDec(row.P) : '—'}
                    </td>
                    <td className="tabular" style={{ textAlign: 'right' }}>
                      {row.E ? fmtDec(row.E) : '—'}
                    </td>
                    <td className="tabular" style={{ textAlign: 'right' }}>
                      {row.Ec ? fmtDec(row.Ec) : '—'}
                    </td>
                    <td className="tabular" style={{ textAlign: 'right' }}>
                      {row.EcInE ? fmtDec(row.EcInE) : '—'}
                    </td>
                    <td className="tabular" style={{ textAlign: 'right' }}>
                      {row.mpe ? fmtDec(row.mpe) : '—'}
                    </td>
                    <td>{verdictLabel(row.verdict)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--muted-foreground, #5a6378)' }}>No observations recorded.</p>
          )}

          {points.length > 0 ? (
            <div className="avoid-break" style={{ marginTop: '3mm' }}>
              <EnvelopeSvg points={points} />
            </div>
          ) : null}

          <p style={{ fontWeight: 600, marginTop: '2mm' }}>
            Verdict: {verdictLabel(test.verdict ?? test.result?.verdict ?? 'INCOMPLETE')}
          </p>
        </>
      )}
    </section>
  );
}
