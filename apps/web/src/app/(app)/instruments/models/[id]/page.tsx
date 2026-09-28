import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { getInstrumentModel, listManufacturers } from '@/server/queries/masterdata';
import { requireSession } from '@/server/session';
import { ModelDetailClient } from './ModelDetailClient';

export const metadata: Metadata = { title: 'Instrument model' };

export default async function InstrumentModelPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const [model, manufacturers] = await Promise.all([getInstrumentModel(id), listManufacturers()]);
  if (!model) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={model.modelName} description={model.manufacturerName} />
      <ModelDetailClient model={model} manufacturers={manufacturers} />
    </div>
  );
}
