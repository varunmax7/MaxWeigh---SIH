'use client';

import type { Role } from '@tula/db';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StatusChip } from '@/components/metrology/StatusChip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { diffRulepackContent } from '@/lib/rulepack-diff';
import {
  cancelRulepackPublishInitiationAction,
  confirmRulepackPublishAction,
  initiateRulepackPublishAction,
  updateRulepackDraftAction,
} from '@/server/actions/rulepacks';
import type { RulepackDetailRow } from '@/server/queries/rulepacks';
import { RulepackReadable, type RulepackReadableContent } from './RulepackReadable';
import { SandboxCompare } from './SandboxCompare';

const LIMIT_FORM_FIELDS: { path: string; label: string }[] = [
  { path: 'zeroSettingAccuracyE', label: 'Zero-setting accuracy (× e)' },
  { path: 'zeroTrackingRateMaxEPerSec', label: 'Zero-tracking rate max (e/s)' },
  { path: 'discriminationExtraD', label: 'Discrimination extra load (× d)' },
  { path: 'creep30MinE', label: 'Creep, 30 min (× e)' },
  { path: 'creep15to30MaxE', label: 'Creep, 15–30 min (× e)' },
  { path: 'zeroReturnMaxE', label: 'Zero return (× e)' },
  {
    path: 'repeatability.maxLoadKgForTenReadings',
    label: 'Repeatability — 10-reading threshold (kg)',
  },
  { path: 'repeatability.readingsHigh', label: 'Repeatability — readings above threshold' },
  { path: 'repeatability.readingsLow', label: 'Repeatability — readings below threshold' },
];

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (typeof acc !== 'object' || acc === null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split('.');
  const clone: Record<string, unknown> = structuredClone(obj);
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i] as string;
    const next = cursor[key];
    cursor[key] =
      typeof next === 'object' && next !== null ? { ...(next as Record<string, unknown>) } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1] as string] = value;
  return clone;
}

function DraftEditor({
  id,
  version,
  initialContent,
}: {
  id: string;
  version: string;
  initialContent: Record<string, unknown>;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [rawText, setRawText] = useState(JSON.stringify(initialContent, null, 2));
  const [rawError, setRawError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateLimit(path: string, value: string) {
    const limits = (content.limits ?? {}) as Record<string, unknown>;
    const nextLimits = setPath(limits, path, value);
    const next = { ...content, limits: nextLimits };
    setContent(next);
    setRawText(JSON.stringify(next, null, 2));
  }

  function handleRawChange(text: string) {
    setRawText(text);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setContent(parsed);
      setRawError(null);
    } catch {
      setRawError('Not valid JSON — fix it before saving.');
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await updateRulepackDraftAction({ id, version, content });
    setSaving(false);
    if (!result.ok) {
      setSaveError(
        result.code === 'RULE'
          ? 'This content does not pass rule-pack validation. Check the JSON below.'
          : result.code === 'CONFLICT'
            ? 'This draft has a pending publish confirmation — cancel it before editing.'
            : 'Could not save.',
      );
      return;
    }
    router.refresh();
  }

  const limits = (content.limits ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {LIMIT_FORM_FIELDS.map((field) => {
          const value = getPath(limits, field.path);
          return (
            <label key={field.path} className="space-y-1 text-xs text-muted-foreground">
              {field.label}
              <input
                className="tabular block h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                onChange={(e) => updateLimit(field.path, e.target.value)}
              />
            </label>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Full content (JSON)</p>
        <Textarea
          value={rawText}
          onChange={(e) => handleRawChange(e.target.value)}
          rows={16}
          className="tabular font-mono text-xs"
        />
        {rawError ? (
          <p role="alert" className="text-xs text-fail">
            {rawError}
          </p>
        ) : null}
      </div>

      {saveError ? (
        <p role="alert" className="text-sm text-fail">
          {saveError}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={saving || Boolean(rawError)}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

function PublishControls({
  id,
  version,
  status,
  publishedByName,
  role,
}: {
  id: string;
  version: string;
  status: string;
  publishedByName: string | null;
  role: Role;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'DRAFT') return null;
  const hasPendingConfirmation = publishedByName !== null;

  async function run(action: () => Promise<{ ok: boolean; code?: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError('Could not complete that action.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4">
      <h2 className="text-sm font-semibold">Publish (two-person, §6.2 SoD-3)</h2>
      {hasPendingConfirmation ? (
        <p className="text-sm text-muted-foreground">
          Proposed for publish by <span className="font-medium">{publishedByName}</span> — awaiting
          a controller's confirmation.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          An administrator initiates; a different controller confirms.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-fail">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!hasPendingConfirmation && role === 'ADMIN' ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => initiateRulepackPublishAction({ id, version }))}
          >
            Propose publish
          </Button>
        ) : null}
        {hasPendingConfirmation && role === 'ADMIN' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => cancelRulepackPublishInitiationAction({ id, version }))}
          >
            Cancel proposal
          </Button>
        ) : null}
        {hasPendingConfirmation && role === 'CONTROLLER' ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => confirmRulepackPublishAction({ id, version }))}
          >
            Confirm publish
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function RulepackDetailClient({
  detail,
  publishedContent,
  canDraft,
  role,
}: {
  detail: RulepackDetailRow;
  publishedContent: Record<string, unknown> | null;
  canDraft: boolean;
  role: Role;
}) {
  const diff = publishedContent ? diffRulepackContent(publishedContent, detail.content) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip status={detail.status as 'DRAFT' | 'PUBLISHED' | 'RETIRED'} />
        <p className="tabular text-xs text-muted-foreground">
          sha256 {detail.contentSha256.slice(0, 12)}…
        </p>
        {detail.createdByName ? (
          <p className="text-xs text-muted-foreground">Created by {detail.createdByName}</p>
        ) : null}
      </div>

      <Tabs defaultValue="readable">
        <TabsList>
          <TabsTrigger value="readable">Readable</TabsTrigger>
          {publishedContent ? <TabsTrigger value="diff">Diff vs published</TabsTrigger> : null}
          {detail.status === 'DRAFT' && canDraft ? (
            <TabsTrigger value="edit">Edit draft</TabsTrigger>
          ) : null}
          {canDraft ? <TabsTrigger value="sandbox">Sandbox</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="readable">
          <RulepackReadable content={detail.content as unknown as RulepackReadableContent} />
        </TabsContent>

        {publishedContent ? (
          <TabsContent value="diff">
            {diff.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Identical to the currently published pack.
              </p>
            ) : (
              <ul className="space-y-2">
                {diff.map((entry) => (
                  <li
                    key={entry.path}
                    className="rounded-[var(--radius-control)] border border-border p-3 text-sm"
                  >
                    <p className="tabular font-medium">{entry.path}</p>
                    <p className="tabular text-xs text-fail">− {JSON.stringify(entry.before)}</p>
                    <p className="tabular text-xs text-pass">+ {JSON.stringify(entry.after)}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ) : null}

        {detail.status === 'DRAFT' && canDraft ? (
          <TabsContent value="edit" className="space-y-6">
            <DraftEditor id={detail.id} version={detail.version} initialContent={detail.content} />
            <PublishControls
              id={detail.id}
              version={detail.version}
              status={detail.status}
              publishedByName={detail.publishedByName}
              role={role}
            />
          </TabsContent>
        ) : null}

        {canDraft ? (
          <TabsContent value="sandbox">
            <SandboxCompare id={detail.id} version={detail.version} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
