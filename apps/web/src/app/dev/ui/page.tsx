import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DevUiGallery } from './DevUiGallery';

export const metadata: Metadata = { title: 'Component gallery' };

/**
 * Every component in every state (implementation.md §7.6, §10 P3) — dev
 * only. `proxy.ts` already excludes `/dev/` from the session gate; this
 * 404s in production regardless, so it can never ship reachable.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <DevUiGallery />;
}
