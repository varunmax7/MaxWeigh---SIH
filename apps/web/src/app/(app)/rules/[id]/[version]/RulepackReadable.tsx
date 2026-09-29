import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ClassificationBand {
  eMin: string;
  eMax?: string;
  nMin: number;
  nMax?: number;
  minE: number;
}

interface MpeBand {
  upToE: number | null;
  mpeE: string;
}

interface TestEntry {
  code: string;
  title: string;
  clause: string;
  mvp?: boolean;
}

export interface RulepackReadableContent {
  classification: Record<string, ClassificationBand[]>;
  mpeBands: Record<string, MpeBand[]>;
  inServiceFactor: number;
  tests: TestEntry[];
  limits: Record<string, unknown>;
  verification: { verifiedBy: string | null; verifiedAt: string | null; source: string };
}

function formatLimitValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Renders a rule pack's tables in readable form (implementation.md §7.5:
 * "detail renders the tables (classification, MPE bands, test catalog) in
 * readable form"). Read-only — the draft editor is a separate component.
 */
export function RulepackReadable({ content }: { content: RulepackReadableContent }) {
  const classes = Object.keys(content.classification);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Classification (Table 3)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>e range</TableHead>
              <TableHead>n min</TableHead>
              <TableHead>n max</TableHead>
              <TableHead>Min (lower limit)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.flatMap((cls) =>
              content.classification[cls]?.map((band) => (
                <TableRow key={`${cls}-${band.eMin}-${band.eMax ?? ''}`}>
                  <TableCell className="tabular font-medium">{cls}</TableCell>
                  <TableCell className="tabular">
                    {band.eMax ? `${band.eMin} g ≤ e ≤ ${band.eMax} g` : `${band.eMin} g ≤ e`}
                  </TableCell>
                  <TableCell className="tabular">{band.nMin}</TableCell>
                  <TableCell className="tabular">{band.nMax ?? '—'}</TableCell>
                  <TableCell className="tabular">{band.minE} × e</TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Maximum permissible errors (Table 6) — in-service factor {content.inServiceFactor}×
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Up to m (in e)</TableHead>
              <TableHead>MPE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.flatMap((cls) =>
              content.mpeBands[cls]?.map((band) => (
                <TableRow key={`${cls}-${band.upToE ?? 'unbounded'}`}>
                  <TableCell className="tabular font-medium">{cls}</TableCell>
                  <TableCell className="tabular">{band.upToE ?? '—'}</TableCell>
                  <TableCell className="tabular">±{band.mpeE} e</TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Test catalogue</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Clause</TableHead>
              <TableHead>MVP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {content.tests.map((test) => (
              <TableRow key={test.code}>
                <TableCell className="tabular font-medium">{test.code}</TableCell>
                <TableCell>{test.title}</TableCell>
                <TableCell className="tabular">{test.clause}</TableCell>
                <TableCell>{test.mvp ? 'Yes' : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Limits</h2>
        <Table>
          <TableBody>
            {Object.entries(content.limits).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="w-1/3 font-medium">{key}</TableCell>
                <TableCell className="tabular break-all">{formatLimitValue(value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-1 text-sm text-muted-foreground">
        <p>
          Verification: {content.verification.verifiedBy ? 'verified' : 'not yet verified'} against{' '}
          {content.verification.source || 'the source PDF'}.
        </p>
      </section>
    </div>
  );
}
