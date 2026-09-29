/**
 * Seed data (implementation.md §10, P2): the 7 RRSL labs and one user per
 * role in RRSL Bengaluru, password from `SEED_PASSWORD`. Run via `pnpm db:seed`.
 *
 * Idempotent: re-running skips labs and users that already exist, so it is
 * safe to run again after `pnpm db:migrate` on the same database.
 *
 * `pnpm db:seed --volume` additionally runs `seedVolume()` (§10 P9): ~10 000
 * synthetic historical evaluations/reports for performance-testing the
 * Reports repository, dashboard and search — see `seed-volume.ts`.
 */
import { createHash } from 'node:crypto';
import { env, loadRootEnv } from '@tula/config';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { betterAuth } from 'better-auth';
import { and, eq } from 'drizzle-orm';
import { buildAuthOptions } from './auth-config.js';
import { createDb } from './client.js';
import { labMembers, labs, ROLES, type Role, rulepacks, user } from './schema/index.js';
import { seedVolume } from './seed-volume.js';

loadRootEnv();
const config = env();

const { db, sql } = createDb(config.DATABASE_URL);

const auth = betterAuth(
  buildAuthOptions({ db, secret: config.AUTH_SECRET, baseURL: config.APP_URL }),
);

/** implementation.md §10 P2: the 7 Regional Reference Standards Laboratories. */
const SEED_LABS = [
  { code: 'RRSL-AMD', name: 'RRSL Ahmedabad', state: 'Gujarat' },
  { code: 'RRSL-BLR', name: 'RRSL Bengaluru', state: 'Karnataka' },
  { code: 'RRSL-BBI', name: 'RRSL Bhubaneswar', state: 'Odisha' },
  { code: 'RRSL-FBD', name: 'RRSL Faridabad', state: 'Haryana' },
  { code: 'RRSL-GAU', name: 'RRSL Guwahati', state: 'Assam' },
  { code: 'RRSL-NAG', name: 'RRSL Nagpur', state: 'Maharashtra' },
  { code: 'RRSL-VNS', name: 'RRSL Varanasi', state: 'Uttar Pradesh' },
] as const;

const ROLE_SEED: Record<Role, { name: string; designation: string }> = {
  ADMIN: { name: 'Seed Admin', designation: 'System administrator' },
  INTAKE_OFFICER: { name: 'Seed Intake Officer', designation: 'Intake officer' },
  TESTING_OFFICER: { name: 'Seed Testing Officer', designation: 'Testing officer' },
  SENIOR_TESTING_OFFICER: {
    name: 'Seed Senior Testing Officer',
    designation: 'Senior testing officer (Tier 1)',
  },
  CHIEF_METROLOGY_OFFICER: {
    name: 'Seed Chief Metrology Officer',
    designation: 'Chief metrology officer (Tier 2)',
  },
  CONTROLLER: { name: 'Seed Controller', designation: 'Controller (Tier 3)' },
  AUDITOR: { name: 'Seed Auditor', designation: 'Auditor' },
};

function emailFor(role: Role): string {
  return `${role.toLowerCase().replaceAll('_', '.')}@tula.test`;
}

/**
 * Seeds a `PUBLISHED` `rulepacks` row mirroring the compiled
 * `oiml-r76-1-2006@1.0.0` pack (implementation.md §10 P10) — the table
 * exists in the schema since P2 but nothing has ever populated it: the
 * engine/evaluation code paths always import `OIML_R76_1_2006` from
 * `@tula/rulepacks` directly, never this table (§4.11: "publishing a new
 * rule pack never changes an existing evaluation"). This row exists only
 * so the rule-pack admin screens (list/detail/clone/publish) have the real
 * currently-in-force pack to start from, already marked as its own SoD-3
 * initiator/confirmer pair so it reads as genuinely published, not a stub.
 */
async function seedPublishedRulepack(): Promise<void> {
  const [existing] = await db
    .select({ id: rulepacks.id })
    .from(rulepacks)
    .where(
      and(eq(rulepacks.id, OIML_R76_1_2006.id), eq(rulepacks.version, OIML_R76_1_2006.version)),
    );
  if (existing) {
    console.info(`Rule pack already seeded → ${OIML_R76_1_2006.id}@${OIML_R76_1_2006.version}`);
    return;
  }

  const [admin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, emailFor('ADMIN')));
  const [controller] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, emailFor('CONTROLLER')));
  if (!admin || !controller) {
    throw new Error('ADMIN/CONTROLLER seed users must exist before seeding the rule pack');
  }

  const content = OIML_R76_1_2006 as unknown as Record<string, unknown>;
  await db.insert(rulepacks).values({
    id: OIML_R76_1_2006.id,
    version: OIML_R76_1_2006.version,
    status: 'PUBLISHED',
    title: OIML_R76_1_2006.title,
    content,
    contentSha256: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
    createdBy: admin.id,
    publishedBy: admin.id,
    confirmedBy: controller.id,
    publishedAt: new Date(),
  });
  console.info(`Seeded rule pack → ${OIML_R76_1_2006.id}@${OIML_R76_1_2006.version}`);
}

async function main() {
  const insertedLabs = await db
    .insert(labs)
    .values(SEED_LABS.map((lab) => ({ code: lab.code, name: lab.name, state: lab.state })))
    .onConflictDoNothing({ target: labs.code })
    .returning({ id: labs.id, code: labs.code });

  const existingLabs = await db.select({ id: labs.id, code: labs.code }).from(labs);
  const bengaluru = [...insertedLabs, ...existingLabs].find((lab) => lab.code === 'RRSL-BLR');
  if (!bengaluru) throw new Error('RRSL-BLR was not seeded');

  console.info(`Labs ready (${SEED_LABS.length} total, RRSL-BLR id=${bengaluru.id}).`);

  for (const role of ROLES) {
    const email = emailFor(role);
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));

    let userId = existing?.id;
    if (!userId) {
      const seed = ROLE_SEED[role];
      const result = await auth.api.signUpEmail({
        body: {
          name: seed.name,
          email,
          password: config.SEED_PASSWORD,
          role,
          designation: seed.designation,
          employeeId: `SEED-${role}`,
        },
      });
      userId = result.user.id;
      console.info(`Created ${role} → ${email}`);
    } else {
      console.info(`Already exists ${role} → ${email}`);
    }

    await db.insert(labMembers).values({ userId, labId: bengaluru.id }).onConflictDoNothing();
  }

  await seedPublishedRulepack();

  console.info('Seed complete.');

  if (process.argv.includes('--volume')) {
    await seedVolume(db, auth, config.SEED_PASSWORD);
  }
}

await main();
await sql.end();
