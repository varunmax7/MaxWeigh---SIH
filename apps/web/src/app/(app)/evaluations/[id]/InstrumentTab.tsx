import { instrumentMetrologySchema } from '@tula/schemas';
import { SpecLine } from '@/components/metrology';
import type { getEvaluationOverview } from '@/server/queries/evaluations';

type Evaluation = NonNullable<Awaited<ReturnType<typeof getEvaluationOverview>>>;

/** Instrument tab (implementation.md §7.5): the frozen spec_snapshot this evaluation was planned and tested against. */
export function InstrumentTab({ evaluation }: { evaluation: Evaluation }) {
  const parsed = instrumentMetrologySchema.safeParse(evaluation.specSnapshot);
  if (!parsed.success) {
    return <p className="text-sm text-fail">This evaluation's spec snapshot could not be read.</p>;
  }
  const spec = parsed.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Model</p>
          <p>{evaluation.modelName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Manufacturer</p>
          <p>{evaluation.manufacturerName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Applicant</p>
          <p>{evaluation.applicantName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Sample serial numbers</p>
          <p className="tabular">{evaluation.sampleSerials?.join(', ') || '—'}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Metrology parameters (frozen at intake)</p>
        <div className="space-y-1.5 rounded-[var(--radius-panel)] border border-border p-4">
          {spec.ranges.map((range, i) => (
            <SpecLine
              // biome-ignore lint/suspicious/noArrayIndexKey: ranges have no id of their own; order is the identity.
              key={i}
              accuracyClass={spec.accuracyClass}
              max={range.max}
              maxUnit={spec.displayUnit}
              min={spec.min}
              e={range.e}
              d={range.d}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Temperature range</p>
          <p className="tabular">
            {spec.tempRange.lowC} to {spec.tempRange.highC} °C
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Load receptor</p>
          <p>
            {spec.loadReceptor.kind}, {spec.loadReceptor.supports} support
            {spec.loadReceptor.supports === 1 ? '' : 's'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Rule pack</p>
          <p className="tabular">
            {evaluation.rulepackId}@{evaluation.rulepackVersion}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Engine version</p>
          <p className="tabular">{evaluation.engineVersion}</p>
        </div>
      </div>
    </div>
  );
}
