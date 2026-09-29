/**
 * Read queries for rule-pack admin (implementation.md §5 `rulepacks`, §10
 * P10). Not lab-scoped — a rule pack is a shared, versioned artifact, the
 * same way `instrument_models` is (§11's "own labs" scoping is for
 * evaluations/reports/reference equipment, not the rule catalogue itself).
 */
import { rulepacks, user } from '@tula/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db';

export interface RulepackListRow {
  id: string;
  version: string;
  status: string;
  title: string;
  contentSha256: string;
  createdByName: string | null;
  publishedByName: string | null;
  confirmedByName: string | null;
  publishedAt: Date | null;
}

async function attachNames<
  T extends { createdBy: string | null; publishedBy: string | null; confirmedBy: string | null },
>(rows: T[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.createdBy) ids.add(row.createdBy);
    if (row.publishedBy) ids.add(row.publishedBy);
    if (row.confirmedBy) ids.add(row.confirmedBy);
  }
  if (ids.size === 0) return new Map();
  const users = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...ids]));
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function listRulepacks(): Promise<RulepackListRow[]> {
  const rows = await db
    .select({
      id: rulepacks.id,
      version: rulepacks.version,
      status: rulepacks.status,
      title: rulepacks.title,
      contentSha256: rulepacks.contentSha256,
      createdBy: rulepacks.createdBy,
      publishedBy: rulepacks.publishedBy,
      confirmedBy: rulepacks.confirmedBy,
      publishedAt: rulepacks.publishedAt,
    })
    .from(rulepacks)
    .orderBy(rulepacks.id, desc(rulepacks.version));

  const names = await attachNames(rows);
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    contentSha256: row.contentSha256,
    createdByName: row.createdBy ? (names.get(row.createdBy) ?? null) : null,
    publishedByName: row.publishedBy ? (names.get(row.publishedBy) ?? null) : null,
    confirmedByName: row.confirmedBy ? (names.get(row.confirmedBy) ?? null) : null,
    publishedAt: row.publishedAt,
  }));
}

export interface RulepackDetailRow {
  id: string;
  version: string;
  status: string;
  title: string;
  content: Record<string, unknown>;
  contentSha256: string;
  createdByName: string | null;
  publishedByName: string | null;
  confirmedByName: string | null;
  publishedAt: Date | null;
}

export async function getRulepackVersion(
  id: string,
  version: string,
): Promise<RulepackDetailRow | null> {
  const [row] = await db
    .select()
    .from(rulepacks)
    .where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));
  if (!row) return null;
  const names = await attachNames([row]);
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    title: row.title,
    content: row.content,
    contentSha256: row.contentSha256,
    createdByName: row.createdBy ? (names.get(row.createdBy) ?? null) : null,
    publishedByName: row.publishedBy ? (names.get(row.publishedBy) ?? null) : null,
    confirmedByName: row.confirmedBy ? (names.get(row.confirmedBy) ?? null) : null,
    publishedAt: row.publishedAt,
  };
}

export async function getPublishedRulepack(id: string): Promise<RulepackDetailRow | null> {
  const [row] = await db
    .select()
    .from(rulepacks)
    .where(and(eq(rulepacks.id, id), eq(rulepacks.status, 'PUBLISHED')));
  if (!row) return null;
  return getRulepackVersion(row.id, row.version);
}

export async function listVersionStringsFor(id: string): Promise<string[]> {
  const rows = await db
    .select({ version: rulepacks.version })
    .from(rulepacks)
    .where(eq(rulepacks.id, id));
  return rows.map((r) => r.version);
}
