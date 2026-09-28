import { createLoader, parseAsBoolean, parseAsInteger, parseAsString } from 'nuqs/server';

/**
 * Evaluations list filters, shared between the server page (parses
 * `searchParams` once) and the client filter bar (`useQueryStates`, same
 * parser map) — implementation.md §7.5 "Evaluations list ... persisted in
 * URL via nuqs"; §10 P5 acceptance: "Filters survive reload and can be
 * shared by URL."
 */
export const evaluationsSearchParams = {
  status: parseAsString,
  accuracyClass: parseAsString,
  testerId: parseAsString,
  verdict: parseAsString,
  createdFrom: parseAsString,
  createdTo: parseAsString,
  overdue: parseAsBoolean,
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
};

export const loadEvaluationsSearchParams = createLoader(evaluationsSearchParams);
