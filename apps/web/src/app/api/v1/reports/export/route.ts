import { NextResponse } from 'next/server';
import { getActiveLabId } from '@/server/active-lab';
import { listReportsForExport, type ReportFilters } from '@/server/queries/reports';
import { can } from '@/server/rbac';
import { getSession } from '@/server/session';

const CSV_HEADER = [
  'Report no.',
  'Certificate no.',
  'Manufacturer',
  'Model',
  'Class',
  'Max (g)',
  'Verdict',
  'Issued',
  'Status',
];

/** Never a formula-injection vector (Excel/Sheets treat a leading `=`/`+`/`-`/`@` as a formula) and never breaks the row on a comma/quote/newline. */
function csvCell(value: string | null): string {
  const v = value ?? '';
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replaceAll('"', '""')}"`;
}

function filtersFromSearchParams(
  params: URLSearchParams,
): Omit<ReportFilters, 'page' | 'pageSize'> {
  return {
    q: params.get('q') ?? undefined,
    accuracyClass: params.get('accuracyClass') ?? undefined,
    verdict: params.get('verdict') ?? undefined,
    status: params.get('status') ?? undefined,
    manufacturerId: params.get('manufacturerId') ?? undefined,
    issuedFrom: params.get('issuedFrom') ?? undefined,
    issuedTo: params.get('issuedTo') ?? undefined,
  };
}

/**
 * Reports repository CSV export (implementation.md §7.5 "CSV export"). A
 * synchronous route, unlike the bulk ZIP export — reading and formatting a
 * few thousand rows of already-indexed data fits well inside one request,
 * with no PDF bytes to fetch from storage.
 */
export async function GET(request: Request): Promise<NextResponse | Response> {
  const session = await getSession();
  if (!session || !can(session.user.role, 'report.export')) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 });
  }

  const labId = await getActiveLabId();
  if (!labId) {
    return NextResponse.json(
      { ok: false, code: 'VALIDATION', issue: 'no active lab' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rows = await listReportsForExport(labId, filtersFromSearchParams(searchParams));

  const lines = [CSV_HEADER.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.reportNo),
        csvCell(row.certificateNo),
        csvCell(row.manufacturerName),
        csvCell(row.modelName),
        csvCell(row.accuracyClass),
        csvCell(row.maxLoadG),
        csvCell(row.overallVerdict),
        csvCell(row.issuedAt ? row.issuedAt.toISOString().slice(0, 10) : null),
        csvCell(row.status),
      ].join(','),
    );
  }

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reports-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
