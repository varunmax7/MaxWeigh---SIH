import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { getLabMemberships } from '@/server/queries/lab-memberships';
import {
  getInstrumentModel,
  listManufacturers,
  listModelEvaluationHistory,
} from '@/server/queries/masterdata';
import { requireSession } from '@/server/session';
import { ModelDetailClient } from './ModelDetailClient';
import { ModelHistoryTimeline } from './ModelHistoryTimeline';

export const metadata: Metadata = { title: 'Instrument model' };

export default async function InstrumentModelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const [model, manufacturers, memberships] = await Promise.all([
    getInstrumentModel(id),
    listManufacturers(),
    getLabMemberships(session.user.id),
  ]);
  if (!model) notFound();

  const history = await listModelEvaluationHistory(
    id,
    memberships.map((m) => m.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={model.modelName} description={model.manufacturerName} />
      <ModelDetailClient model={model} manufacturers={manufacturers} />
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Evaluation history</h2>
        <ModelHistoryTimeline rows={history} />
      </div>
    </div>
  );
}
