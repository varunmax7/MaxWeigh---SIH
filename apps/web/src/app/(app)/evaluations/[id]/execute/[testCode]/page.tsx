import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { instrumentMetrologySchema } from '@tula/schemas';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { assertLabMember } from '@/server/lab-access';
import { findTestId, getTestBattery, getTestExecutionContext } from '@/server/queries/execution';
import { listActiveUnexpiredWeightSets } from '@/server/queries/masterdata';
import { requireSession } from '@/server/session';
import { ExecutionWorkspace } from './ExecutionWorkspace';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; testCode: string }>;
}): Promise<Metadata> {
  const { testCode } = await params;
  const title = OIML_R76_1_2006.tests.find((t) => t.code === testCode)?.title ?? testCode;
  return { title };
}

/** implementation.md §7.5 "Test execution workspace" (§10 P6). */
export default async function ExecuteTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; testCode: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireSession();
  const { id: evaluationId, testCode } = await params;
  const { range } = await searchParams;
  const rangeIndex = range ? Number(range) : 0;

  const testId = await findTestId(
    evaluationId,
    testCode,
    Number.isFinite(rangeIndex) ? rangeIndex : 0,
  );
  if (!testId) notFound();

  const context = await getTestExecutionContext(testId);
  if (!context) notFound();
  await assertLabMember(session.user.id, context.evaluation.labId);

  const specResult = instrumentMetrologySchema.safeParse(context.evaluation.specSnapshot);
  if (!specResult.success) notFound();

  const [battery, weightSets] = await Promise.all([
    getTestBattery(evaluationId),
    listActiveUnexpiredWeightSets(context.evaluation.labId),
  ]);

  const catalog = OIML_R76_1_2006.tests.find((t) => t.code === testCode);
  const readOnly = context.test.status === 'COMPLETED';

  return (
    <ExecutionWorkspace
      evaluationId={evaluationId}
      refNo={context.evaluation.refNo}
      modelLabel={`${context.manufacturerName} ${context.modelName}`}
      spec={specResult.data}
      test={{
        id: context.test.id,
        testCode: context.test.testCode,
        clause: catalog?.clause,
        params: context.test.params,
        observations: context.test.observations,
        rowVersion: context.test.rowVersion,
        envStart: context.test.envStart,
        envEnd: context.test.envEnd,
        weightSetIds: context.test.weightSetIds,
        status: context.test.status,
        startedAt: context.test.startedAt,
      }}
      battery={battery.map((t) => ({
        id: t.id,
        testCode: t.testCode,
        rangeIndex: t.rangeIndex,
        applicability: t.applicability as 'APPLICABLE' | 'NOT_APPLICABLE',
        status: t.status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REOPENED',
        verdict: t.verdict as 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_APPLICABLE' | null,
      }))}
      activeRangeIndex={context.test.rangeIndex}
      weightSets={weightSets.map((w) => ({
        id: w.id,
        setCode: w.setCode,
        oimlClass: w.oimlClass,
        dueOn: w.dueOn,
        items: w.items as unknown as { nominalG: string }[],
      }))}
      readOnly={readOnly}
    />
  );
}
