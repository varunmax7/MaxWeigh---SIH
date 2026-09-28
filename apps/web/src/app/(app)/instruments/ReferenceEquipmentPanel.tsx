import type { listEnvSensors, listReferenceWeightSets } from '@/server/queries/masterdata';
import { EnvSensorsPanel } from './EnvSensorsPanel';
import { WeightSetsPanel } from './WeightSetsPanel';

type WeightSet = Awaited<ReturnType<typeof listReferenceWeightSets>>[number];
type Sensor = Awaited<ReturnType<typeof listEnvSensors>>[number];

/**
 * Reference equipment tab (implementation.md §7.5): weight sets and env
 * sensors are two independent sections sharing one lab scope — split into
 * `WeightSetsPanel`/`EnvSensorsPanel` to keep each file under §11's 400-line
 * limit, not because they interact with each other.
 */
export function ReferenceEquipmentPanel({
  weightSets,
  sensors,
  activeLabId,
}: {
  weightSets: WeightSet[];
  sensors: Sensor[];
  activeLabId: string | null;
}) {
  if (!activeLabId) {
    return (
      <p className="rounded-[var(--radius-panel)] border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        Choose a lab to see its reference equipment.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <WeightSetsPanel weightSets={weightSets} labId={activeLabId} />
      <EnvSensorsPanel sensors={sensors} labId={activeLabId} />
    </div>
  );
}
