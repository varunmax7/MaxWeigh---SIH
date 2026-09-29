import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';

/**
 * Reports repository filters (implementation.md §7.5), shared between the
 * server page and the client filter bar — same URL-persistence convention
 * `evaluations/search-params.ts` set up in P5 (§10 P9 acceptance: "Filters
 * and search are shareable by URL").
 */
export const reportsSearchParams = {
  q: parseAsString,
  accuracyClass: parseAsString,
  verdict: parseAsString,
  status: parseAsString,
  manufacturerId: parseAsString,
  issuedFrom: parseAsString,
  issuedTo: parseAsString,
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
};

export const loadReportsSearchParams = createLoader(reportsSearchParams);
