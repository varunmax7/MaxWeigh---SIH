import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell/PageHeader';
import { getActiveLabId } from '@/server/active-lab';
import {
  listApplicants,
  listEnvSensors,
  listInstrumentModels,
  listManufacturers,
  listReferenceWeightSets,
} from '@/server/queries/masterdata';
import { requireSession } from '@/server/session';
import { InstrumentsTabs } from './InstrumentsTabs';

export const metadata: Metadata = { title: 'Instruments' };

/**
 * Tabs: Models, Manufacturers, Applicants, Reference equipment
 * (implementation.md §7.5). Fetched server-side once; each tab's create
 * flow calls `router.refresh()` to re-fetch after a mutation rather than
 * keeping its own client-side copy of the list.
 */
export default async function InstrumentsPage() {
  await requireSession();
  const activeLabId = await getActiveLabId();

  const [manufacturers, applicants, models, weightSets, sensors] = await Promise.all([
    listManufacturers(),
    listApplicants(),
    listInstrumentModels(),
    activeLabId ? listReferenceWeightSets(activeLabId) : Promise.resolve([]),
    activeLabId ? listEnvSensors(activeLabId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instruments & specs"
        description="Manufacturers, applicants, instrument models and lab reference equipment."
      />
      <InstrumentsTabs
        manufacturers={manufacturers}
        applicants={applicants}
        models={models}
        weightSets={weightSets}
        sensors={sensors}
        activeLabId={activeLabId}
      />
    </div>
  );
}
