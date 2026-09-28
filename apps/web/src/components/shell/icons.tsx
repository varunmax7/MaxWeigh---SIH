'use client';

import {
  Award,
  BookOpen,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { NavIconName } from './nav-config';

/** Client-only lookup — see the comment on `NavIconName` for why this isn't in `nav-config.ts`. */
export const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  evaluations: ClipboardList,
  workspace: ListChecks,
  instruments: Wrench,
  reports: FileStack,
  audit: ScrollText,
  rules: Award,
  settings: Settings,
  regulatory: BookOpen,
};
