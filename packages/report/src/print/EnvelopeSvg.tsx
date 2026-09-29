/**
 * The error-envelope chart, redrawn for print (implementation.md §7.1's
 * "one signature visual" and §8.1 item 6: "error envelope chart where
 * load-based"). A small, self-contained static SVG rather than a shared
 * import from `apps/web`'s `ErrorEnvelopeChart` — that component is a
 * Client Component in the wrong app for this package to depend on, and the
 * print version has no hover/interaction to justify sharing more than the
 * handful of lines of math both draw from.
 */
const WIDTH = 480;
const HEIGHT = 200;
const PAD = { top: 10, right: 12, bottom: 24, left: 44 };

export interface EnvelopePoint {
  rowId: string;
  L: number;
  Ec: number;
  mpe: number;
}

function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

export function EnvelopeSvg({ points }: { points: EnvelopePoint[] }) {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.L - b.L);
  const maxAbsMpe = Math.max(...sorted.map((p) => Math.abs(p.mpe)), 0.0001);
  const yBound = Math.max(...sorted.map((p) => Math.abs(p.Ec)), maxAbsMpe) * 1.15;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;

  const xScale = scale([first.L, last.L], [PAD.left, WIDTH - PAD.right]);
  const yScale = scale([-yBound, yBound], [HEIGHT - PAD.bottom, PAD.top]);

  const step = (accessor: (p: EnvelopePoint) => number) =>
    sorted
      .map((p, i) => {
        const x = xScale(p.L);
        const y = yScale(accessor(p));
        if (i === 0) return `M ${x} ${y}`;
        const prevX = xScale(sorted[i - 1]?.L ?? p.L);
        const midX = (prevX + x) / 2;
        const prevY = yScale(accessor(sorted[i - 1] ?? p));
        return `L ${midX} ${prevY} L ${midX} ${y} L ${x} ${y}`;
      })
      .join(' ');

  const upper = step((p) => p.mpe);
  const lower = step((p) => -p.mpe);
  const zeroY = yScale(0);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label="Corrected error against load, with the permissible error band"
    >
      <title>Corrected error vs load</title>
      <path
        d={`${upper} L ${xScale(last.L)} ${yScale(-last.mpe)} ${lower
          .split(' ')
          .reverse()
          .join(' ')} Z`}
        fill="var(--envelope-fill, #e7eaf6)"
        opacity={0.7}
      />
      <path d={upper} fill="none" stroke="var(--envelope-edge, #9aa6d6)" strokeWidth={1} />
      <path d={lower} fill="none" stroke="var(--envelope-edge, #9aa6d6)" strokeWidth={1} />
      <line
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={zeroY}
        y2={zeroY}
        stroke="var(--border, #dce1ea)"
        strokeWidth={1}
      />
      <polyline
        points={sorted.map((p) => `${xScale(p.L)},${yScale(p.Ec)}`).join(' ')}
        fill="none"
        stroke="var(--series-up, #1a2560)"
        strokeWidth={1.5}
      />
      {sorted.map((p) => (
        <circle
          key={p.rowId}
          cx={xScale(p.L)}
          cy={yScale(p.Ec)}
          r={2.5}
          fill={
            Math.abs(p.Ec) > Math.abs(p.mpe) ? 'var(--fail, #b42318)' : 'var(--series-up, #1a2560)'
          }
        />
      ))}
    </svg>
  );
}
