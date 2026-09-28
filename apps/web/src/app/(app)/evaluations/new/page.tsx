import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell/PageHeader';
import { getActiveLabId } from '@/server/active-lab';
import { getEvaluationDraft, listTesters } from '@/server/queries/evaluations';
import {
  listApplicants,
  listInstrumentModels,
  listManufacturers,
} from '@/server/queries/masterdata';
import { requireSession } from '@/server/session';
import { Wizard } from './Wizard';

export const metadata: Metadata = { title: 'New evaluation' };

/** implementation.md §7.5 "New evaluation wizard" (§10 P5). */
export default async function NewEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  await requireSession();
  const activeLabId = await getActiveLabId();
  const { draft: draftId } = await searchParams;

  const [manufacturers, applicants, models, testers, draft] = await Promise.all([
    listManufacturers(),
    listApplicants(),
    listInstrumentModels(),
    activeLabId ? listTesters(activeLabId) : Promise.resolve([]),
    draftId ? getEvaluationDraft(draftId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New evaluation"
        description="Applicant, instrument, metrology parameters, test plan and assignment."
      />
      {activeLabId ? (
        <Wizard
          activeLabId={activeLabId}
          manufacturers={manufacturers}
          applicants={applicants}
          models={models}
          testers={testers}
          draft={draft}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Choose a lab before starting an evaluation.</p>
      )}
    </div>
  );
}
