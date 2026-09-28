export interface EnvelopePoint {
  rowId: string;
  /** Applied load, grams. */
  L: number;
  /** Corrected error, grams. */
  Ec: number;
  /** ± permissible error at this load, grams. */
  mpe: number;
  direction: 'up' | 'down';
}

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { top: 12, right: 12, bottom: 20, left: 36 };

function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/**
 * The one signature visual (implementation.md §7.1): corrected error vs
 * load, with the stepped ±MPE band drawn behind it. Built from each point's
 * own computed `mpe` (piecewise-constant by band) rather than a synthetic
 * curve, so the envelope drawn is exactly what judged pass/fail — never an
 * approximation. Plain inline SVG, reading colour from the §7.2 chart
 * tokens (`--envelope-fill`, `--envelope-edge`, `--series-up`,
 * `--series-down`), not a charting library.
 */
export function ErrorEnvelopeChart({ points }: { points: EnvelopePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-border text-sm text-muted-foreground">
        No readings yet
      </div>
    );
  }

  const sorted = [...points].sort((a, b) => a.L - b.L);
  const maxAbsMpe = Math.max(...sorted.map((p) => Math.abs(p.mpe)), 0.0001);
  const maxAbsEc = Math.max(...sorted.map((p) => Math.abs(p.Ec)), maxAbsMpe);
  const yBound = maxAbsEc * 1.15;

  const xDomain: [number, number] = [sorted[0]?.L ?? 0, sorted[sorted.length - 1]?.L ?? 1];
  const xScale = scaleLinear(xDomain, [PAD.left, WIDTH - PAD.right]);
  const yScale = scaleLinear([-yBound, yBound], [HEIGHT - PAD.bottom, PAD.top]);

  // Stepped envelope: a horizontal run at each point's own mpe, connected by
  // vertical risers at the midpoint between adjacent loads.
  const upperPath = sorted
    .map((p, i) => {
      const x = xScale(p.L);
      const y = yScale(p.mpe);
      if (i === 0) return `M ${x} ${y}`;
      const prevX = xScale(sorted[i - 1]?.L ?? p.L);
      const midX = (prevX + x) / 2;
      const prevY = yScale(sorted[i - 1]?.mpe ?? p.mpe);
      return `L ${midX} ${prevY} L ${midX} ${y} L ${x} ${y}`;
    })
    .join(' ');
  const lowerPathReversed = [...sorted]
    .reverse()
    .map((p, i, arr) => {
      const x = xScale(p.L);
      const y = yScale(-p.mpe);
      if (i === 0) return `L ${x} ${y}`;
      const prevX = xScale(arr[i - 1]?.L ?? p.L);
      const midX = (prevX + x) / 2;
      const prevY = yScale(-(arr[i - 1]?.mpe ?? p.mpe));
      return `L ${midX} ${prevY} L ${midX} ${y} L ${x} ${y}`;
    })
    .join(' ');
  const envelopeFill = `${upperPath} ${lowerPathReversed} Z`;

  const upPoints = sorted.filter((p) => p.direction === 'up');
  const downPoints = sorted.filter((p) => p.direction === 'down');
  const linePath = (pts: EnvelopePoint[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.L)} ${yScale(p.Ec)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Corrected error versus load, with the permissible error band"
    >
      <title>Corrected error vs load</title>
      <line
        x1={PAD.left}
        y1={yScale(0)}
        x2={WIDTH - PAD.right}
        y2={yScale(0)}
        stroke="var(--border)"
        strokeWidth={1}
      />
      <path
        d={envelopeFill}
        fill="var(--envelope-fill)"
        stroke="var(--envelope-edge)"
        strokeWidth={1}
      />

      {upPoints.length > 0 ? (
        <path d={linePath(upPoints)} fill="none" stroke="var(--series-up)" strokeWidth={2} />
      ) : null}
      {downPoints.length > 0 ? (
        <path d={linePath(downPoints)} fill="none" stroke="var(--series-down)" strokeWidth={2} />
      ) : null}
      {sorted.map((p) => (
        <circle
          key={p.rowId}
          cx={xScale(p.L)}
          cy={yScale(p.Ec)}
          r={4}
          fill={p.direction === 'up' ? 'var(--series-up)' : 'var(--series-down)'}
          stroke="var(--card)"
          strokeWidth={2}
        >
          <title>{`L=${p.L} g, Ec=${p.Ec} g, mpe=±${p.mpe} g`}</title>
        </circle>
      ))}
    </svg>
  );
}
