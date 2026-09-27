import { redirect } from 'next/navigation';
import { ENTRY_ROUTE } from '@/lib/routes';

/** The root path has no content of its own; authentication decides where you go. */
export default function RootPage(): never {
  redirect(ENTRY_ROUTE);
}
