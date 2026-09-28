'use client';

import { labSettingsInputSchema } from '@tula/schemas';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateLabSettingsAction } from '@/server/actions/settings';
import type { getLab } from '@/server/queries/masterdata';

type Lab = NonNullable<Awaited<ReturnType<typeof getLab>>>;

interface StoredSettings {
  numberingPattern?: string;
  signatoryTitles?: { tier: 1 | 2 | 3; title: string }[];
  slaHours?: number;
}

const settingsSchema = labSettingsInputSchema.shape.settings;

function parseStoredSettings(raw: unknown): StoredSettings {
  const result = settingsSchema.safeParse(raw ?? {});
  return result.success ? (result.data ?? {}) : {};
}

const SIGNATORY_TIERS = [
  { tier: 1 as const, label: 'Tier 1 — Senior testing officer' },
  { tier: 2 as const, label: 'Tier 2 — Chief metrology officer' },
  { tier: 3 as const, label: 'Tier 3 — Controller of legal metrology' },
];

async function uploadLogo(file: File): Promise<string> {
  const form = new FormData();
  form.set('file', file);
  form.set('kind', 'lab_logo');
  const res = await fetch('/api/v1/files', { method: 'POST', body: form });
  const body = await res.json();
  if (!body.ok) throw new Error('Logo upload failed');
  return body.data.id as string;
}

export function SettingsForm({ lab, logoPreviewUrl }: { lab: Lab; logoPreviewUrl: string | null }) {
  const router = useRouter();
  const formId = useId();
  const stored = parseStoredSettings(lab.settings);

  const [name, setName] = useState(lab.name);
  const [address, setAddress] = useState(lab.address ?? '');
  const [state, setState] = useState(lab.state ?? '');
  const [accreditationNo, setAccreditationNo] = useState(lab.accreditationNo ?? '');
  const [reportPrefix, setReportPrefix] = useState(lab.reportPrefix ?? '');
  const [timezone, setTimezone] = useState(lab.timezone);
  const [logoKey, setLogoKey] = useState(lab.logoKey);
  const [logoPreview, setLogoPreview] = useState(logoPreviewUrl);
  const [numberingPattern, setNumberingPattern] = useState(stored.numberingPattern ?? '');
  const [slaHours, setSlaHours] = useState(stored.slaHours?.toString() ?? '');
  const [signatoryTitles, setSignatoryTitles] = useState<Record<1 | 2 | 3, string>>({
    1: stored.signatoryTitles?.find((s) => s.tier === 1)?.title ?? '',
    2: stored.signatoryTitles?.find((s) => s.tier === 2)?.title ?? '',
    3: stored.signatoryTitles?.find((s) => s.tier === 3)?.title ?? '',
  });

  const [pending, setPending] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const attachmentId = await uploadLogo(file);
      setLogoKey(attachmentId);
      setLogoPreview(URL.createObjectURL(file));
      toast.success('Logo uploaded — save settings to apply it');
    } catch {
      setError('Logo upload failed. Try a JPEG, PNG or WebP under 20 MB.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);

    const titles = SIGNATORY_TIERS.map(({ tier }) => ({
      tier,
      title: signatoryTitles[tier].trim(),
    })).filter((s) => s.title.length > 0);

    const result = await updateLabSettingsAction({
      labId: lab.id,
      name,
      address: address || undefined,
      state: state || undefined,
      accreditationNo: accreditationNo || undefined,
      reportPrefix: reportPrefix || undefined,
      timezone,
      logoKey: logoKey ?? undefined,
      settings: {
        numberingPattern: numberingPattern || undefined,
        signatoryTitles: titles.length > 0 ? titles : undefined,
        slaHours: slaHours ? Number(slaHours) : undefined,
      },
    });

    setPending(false);
    if (!result.ok) {
      setError(
        result.code === 'VALIDATION'
          ? 'Check the highlighted fields.'
          : 'Could not save. Try again.',
      );
      return;
    }
    toast.success('Lab settings saved');
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
        >
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Lab profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-name`}>Lab name</Label>
            <Input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-state`}>State</Label>
            <Input
              id={`${formId}-state`}
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor={`${formId}-address`}>Address</Label>
            <Input
              id={`${formId}-address`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-accreditation`}>Accreditation no.</Label>
            <Input
              id={`${formId}-accreditation`}
              value={accreditationNo}
              onChange={(e) => setAccreditationNo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-timezone`}>Timezone</Label>
            <Input
              id={`${formId}-timezone`}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Logo</h2>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize.
            <img
              src={logoPreview}
              alt={`${lab.name} logo`}
              className="size-16 rounded-[var(--radius-control)] border border-border object-contain"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-border text-xs text-muted-foreground">
              No logo
            </div>
          )}
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleLogoChange}
            disabled={uploadingLogo}
            className="max-w-xs"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Report numbering &amp; SLA</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-report-prefix`}>Report prefix</Label>
            <Input
              id={`${formId}-report-prefix`}
              value={reportPrefix}
              onChange={(e) => setReportPrefix(e.target.value)}
              placeholder="EV-BLR"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-sla`}>SLA (hours)</Label>
            <Input
              id={`${formId}-sla`}
              type="number"
              min={1}
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor={`${formId}-numbering`}>Numbering pattern</Label>
            <Input
              id={`${formId}-numbering`}
              value={numberingPattern}
              onChange={(e) => setNumberingPattern(e.target.value)}
              placeholder="EV-{labCode}-{year}-{seq}"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Signatory titles</h2>
        <div className="space-y-3">
          {SIGNATORY_TIERS.map(({ tier, label }) => (
            <div key={tier} className="space-y-1.5">
              <Label htmlFor={`${formId}-signatory-${tier}`}>{label}</Label>
              <Input
                id={`${formId}-signatory-${tier}`}
                value={signatoryTitles[tier]}
                onChange={(e) =>
                  setSignatoryTitles((prev) => ({ ...prev, [tier]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </section>

      <Button onClick={handleSubmit} disabled={pending || uploadingLogo}>
        {pending ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
}
