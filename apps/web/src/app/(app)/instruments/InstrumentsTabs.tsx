'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  listApplicants,
  listEnvSensors,
  listInstrumentModels,
  listManufacturers,
  listReferenceWeightSets,
} from '@/server/queries/masterdata';
import { ApplicantsPanel } from './ApplicantsPanel';
import { ManufacturersPanel } from './ManufacturersPanel';
import { ModelsPanel } from './ModelsPanel';
import { ReferenceEquipmentPanel } from './ReferenceEquipmentPanel';

export function InstrumentsTabs({
  manufacturers,
  applicants,
  models,
  weightSets,
  sensors,
  activeLabId,
}: {
  manufacturers: Awaited<ReturnType<typeof listManufacturers>>;
  applicants: Awaited<ReturnType<typeof listApplicants>>;
  models: Awaited<ReturnType<typeof listInstrumentModels>>;
  weightSets: Awaited<ReturnType<typeof listReferenceWeightSets>>;
  sensors: Awaited<ReturnType<typeof listEnvSensors>>;
  activeLabId: string | null;
}) {
  return (
    <Tabs defaultValue="models">
      <TabsList>
        <TabsTrigger value="models">Models</TabsTrigger>
        <TabsTrigger value="manufacturers">Manufacturers</TabsTrigger>
        <TabsTrigger value="applicants">Applicants</TabsTrigger>
        <TabsTrigger value="reference-equipment">Reference equipment</TabsTrigger>
      </TabsList>

      <TabsContent value="models" className="pt-4">
        <ModelsPanel models={models} manufacturers={manufacturers} />
      </TabsContent>
      <TabsContent value="manufacturers" className="pt-4">
        <ManufacturersPanel manufacturers={manufacturers} />
      </TabsContent>
      <TabsContent value="applicants" className="pt-4">
        <ApplicantsPanel applicants={applicants} manufacturers={manufacturers} />
      </TabsContent>
      <TabsContent value="reference-equipment" className="pt-4">
        <ReferenceEquipmentPanel
          weightSets={weightSets}
          sensors={sensors}
          activeLabId={activeLabId}
        />
      </TabsContent>
    </Tabs>
  );
}
