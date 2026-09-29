/**
 * Synthetic manufacturers/models/applicant/weight-sets and per-lab reviewer
 * users for the `--volume` seed extension. See `seed-volume.ts` for the
 * orchestration this backs.
 *
 * Reviewers are **new** synthetic users, one set per lab — never the base
 * `main()` seed users (`admin@tula.test` and friends). Those are seeded as
 * members of RRSL-BLR only, and `apps/web/src/server/lab-access.test.ts`
 * relies on `admin@tula.test` staying *not* a member of any other lab to
 * exercise `assertLabMember`'s cross-tenant guard — adding them to every
 * lab here would silently break that test. New identities avoid the clash
 * entirely rather than special-casing around it.
 */
import type { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import type { buildAuthOptions } from './auth-config.js';
import type { Db } from './client.js';
import {
  applicants,
  instrumentModels,
  labMembers,
  manufacturers,
  type Role,
  referenceWeightSets,
  user,
} from './schema/index.js';
import { SPEC_ARCHETYPES } from './seed-volume-fixtures.js';

/** The concrete, plugin-augmented type `seed.ts`'s `auth` instance actually has — `ReturnType<typeof betterAuth>` alone erases the `twoFactor`/custom-fields plugins' extra `role`/`designation`/`employeeId` body fields `signUpEmail` needs. */
export type SeedAuth = ReturnType<typeof betterAuth<ReturnType<typeof buildAuthOptions>>>;

export const MANUFACTURER_NAMES = [
  'Aravalli Scales',
  'Bharat Weighing Systems',
  'Coromandel Instruments',
  'Deccan Metrology',
  'Ganga Precision',
  'Himalaya Weightech',
  'Indus Scale Works',
  'Konkan Weighing Co.',
  'Malabar Instruments',
  'Nilgiri Precision Systems',
  'Sahyadri Scale Industries',
  'Vindhya Metrology',
];

export async function ensureMasterData(db: Db, labIds: string[], rng: () => number) {
  const mfrRows = await db
    .insert(manufacturers)
    .values(MANUFACTURER_NAMES.map((name) => ({ name: `Synth ${name}` })))
    .onConflictDoNothing()
    .returning({ id: manufacturers.id, name: manufacturers.name });
  const mfrIds =
    mfrRows.length > 0
      ? mfrRows.map((m) => m.id)
      : (
          await db
            .select({ id: manufacturers.id })
            .from(manufacturers)
            .where(eq(manufacturers.name, `Synth ${MANUFACTURER_NAMES[0]}`))
        ).map((m) => m.id);

  const [applicant] = await db
    .insert(applicants)
    .values({ name: 'Synth Applicant Trading Co.' })
    .onConflictDoNothing()
    .returning({ id: applicants.id });
  const applicantId =
    applicant?.id ?? (await db.select({ id: applicants.id }).from(applicants).limit(1))[0]?.id;
  if (!applicantId) throw new Error('failed to seed a synthetic applicant');

  const modelRows: { id: string }[] = [];
  for (const mfrId of mfrIds) {
    const archetypeCount = 1 + Math.floor(rng() * 2); // 1-2 models per manufacturer
    for (let i = 0; i < archetypeCount; i++) {
      const archetype = SPEC_ARCHETYPES[Math.floor(rng() * SPEC_ARCHETYPES.length)];
      if (!archetype) continue;
      const modelName = `${archetype.label} ${100 + Math.floor(rng() * 900)}`;
      const [row] = await db
        .insert(instrumentModels)
        .values({
          manufacturerId: mfrId,
          modelName,
          instrumentType: 'bench',
          defaultSpec: archetype.spec as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing()
        .returning({ id: instrumentModels.id });
      if (row) modelRows.push({ id: row.id });
    }
  }

  const weightSetIdByLab = new Map<string, string>();
  for (const labId of labIds) {
    const [set] = await db
      .insert(referenceWeightSets)
      .values({
        labId,
        setCode: 'SYNTH-F2-01',
        oimlClass: 'F2',
        items: [{ id: 'w1', nominalG: '1000' }],
        status: 'active',
        dueOn: '2030-01-01',
      })
      .onConflictDoNothing()
      .returning({ id: referenceWeightSets.id });
    if (set) weightSetIdByLab.set(labId, set.id);
  }

  return { applicantId, modelRows, weightSetIdByLab };
}

/** The five roles `seed-volume.ts` actually drives an evaluation through. */
export const REVIEWER_ROLES = [
  'INTAKE_OFFICER',
  'TESTING_OFFICER',
  'SENIOR_TESTING_OFFICER',
  'CHIEF_METROLOGY_OFFICER',
  'CONTROLLER',
] as const satisfies readonly Role[];

export type ReviewerRoles = Record<(typeof REVIEWER_ROLES)[number], string>;

/**
 * One fresh, real (`auth.api.signUpEmail`) user per role per lab — see the
 * module comment for why these are new identities rather than the base
 * seed's. `labCode` only shapes the email; slashes/spaces in a lab code
 * would break it, but every seeded code so far is a plain `RRSL-XXX` token.
 */
export async function ensureLabReviewers(
  db: Db,
  auth: SeedAuth,
  password: string,
  labRows: { id: string; code: string }[],
): Promise<Map<string, ReviewerRoles>> {
  const result = new Map<string, ReviewerRoles>();

  for (const lab of labRows) {
    const slug = lab.code.toLowerCase();
    const roles = {} as ReviewerRoles;
    for (const role of REVIEWER_ROLES) {
      const email = `synth.${role.toLowerCase().replaceAll('_', '.')}.${slug}@tula.test`;
      const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
      let userId = existing?.id;
      if (!userId) {
        const created = await auth.api.signUpEmail({
          body: {
            name: `Synth ${role.replaceAll('_', ' ')} ${lab.code}`,
            email,
            password,
            role,
            employeeId: `SYNTH-${role}-${lab.code}`,
          },
        });
        userId = created.user.id;
      }
      roles[role] = userId;
      await db.insert(labMembers).values({ userId, labId: lab.id }).onConflictDoNothing();
    }
    result.set(lab.id, roles);
  }

  return result;
}
