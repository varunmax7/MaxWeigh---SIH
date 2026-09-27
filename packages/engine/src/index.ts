/**
 * @tula/engine — pure OIML R 76 calculation engine.
 *
 * Binding constraints (implementation.md §3.2, §11):
 *  - zero internal imports, zero I/O;
 *  - all masses and errors are Decimal internally and strings at boundaries;
 *  - constants come only from a rule pack, never from this source.
 *
 * P1 replaces this placeholder with the full API of §4.10.
 */

/** Semantic version of the calculation engine, persisted alongside every result. */
export const ENGINE_VERSION = '0.1.0' as const;

/** Rule-pack identifier expected by the P1 implementation. */
export const DEFAULT_RULEPACK_ID = 'oiml-r76-1-2006' as const;
