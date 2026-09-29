import type { ThroughputMonth } from '@/server/queries/dashboard';

const WIDTH = 480;
const HEIGHT = 180;
const PAD = { top: 8, right: 8, bottom: 24, left: 32 };

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', { month: 'short' });

/**
 * Throughput, last 12 months — stacked issued/not-conforming bars (§7.5's
 * dashboard chart), from the materialized `v_eval_monthly`. Plain inline
 * SVG, same convention as `ErrorEnvelopeChart` — no charting library.
 */
export function ThroughputChart({ months }: { months: ThroughputMonth[] }) {
  if (months.every((m) => m.conforms + m.notConform === 0)) {
    return (
      <div className="flex h-44 items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-border text-sm text-muted-foreground">
        No issued reports yet
      </div>
    );
  }

  const maxTotal = Math.max(...months.map((m) => m.conforms + m.notConform), 1);
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const barWidth = innerWidth / months.length;
  const barGap = barWidth * 0.25;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Throughput over the last 12 months: issued and not-conforming reports"
    >
      <title>Throughput, last 12 months</title>
      <line
        x1={PAD.left}
        y1={HEIGHT - PAD.bottom}
        x2={WIDTH - PAD.right}
        y2={HEIGHT - PAD.bottom}
        stroke="var(--border)"
        strokeWidth={1}
      />
      {months.map((m, i) => {
        const total = m.conforms + m.notConform;
        const totalH = (total / maxTotal) * innerHeight;
        const conformsH = total > 0 ? (m.conforms / total) * totalH : 0;
        const notConformH = totalH - conformsH;
        const x = PAD.left + i * barWidth + barGap / 2;
        const w = barWidth - barGap;
        const baseY = HEIGHT - PAD.bottom;
        const label = MONTH_LABEL.format(new Date(`${m.month}-02`));

        return (
          <g key={m.month}>
            {notConformH > 0 ? (
              <rect x={x} y={baseY - notConformH} width={w} height={notConformH} fill="var(--fail)">
                <title>{`${label}: ${m.notConform} does not conform`}</title>
              </rect>
            ) : null}
            {conformsH > 0 ? (
              <rect
                x={x}
                y={baseY - notConformH - conformsH}
                width={w}
                height={conformsH}
                fill="var(--pass)"
              >
                <title>{`${label}: ${m.conforms} conforms`}</title>
              </rect>
            ) : null}
            <text
              x={x + w / 2}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
