/**
 * @tula/schemas — Zod schemas shared by client and server (implementation.md §2).
 *
 * One schema validates a payload in the browser form and again in the server
 * action, so the two can never drift. Observation schemas are versioned;
 * a stored observation records the schemaVersion it was written against.
 */

/** Version stamped onto every observation payload written by this build. */
export const OBSERVATION_SCHEMA_VERSION = 1 as const;
