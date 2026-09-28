/**
 * Seed data (implementation.md §10, P2): the 7 RRSL labs and one user per
 * role in RRSL Bengaluru, password from `SEED_PASSWORD`. Run via `pnpm db:seed`.
 *
 * Idempotent: re-running skips labs and users that already exist, so it is
 * safe to run again after `pnpm db:migrate` on the same database.
 */
import { env, loadRootEnv } from '@tula/config';
import { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import { buildAuthOptions } from './auth-config.js';
import { createDb } from './client.js';
import { labMembers, labs, ROLES, type Role, user } from './schema/index.js';

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

  console.info('Seed complete.');
}

await main();
await sql.end();
