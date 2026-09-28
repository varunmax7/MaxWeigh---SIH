import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Tula — OIML R 76 type evaluation',
    template: '%s · Tula',
  },
  description:
    'Type evaluation and test reporting for non-automatic weighing instruments under OIML R 76-1:2006.',
  applicationName: 'Tula',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Renders into a <meta name="theme-color"> tag, so it can't reference a
  // CSS custom property — kept equal to --primary (globals.css) by hand.
  // check-no-raw-hex: allow
  themeColor: '#1a2560',
};

/**
 * Light ships as default (implementation.md §7.2: "labs are bright
 * environments") — no theme toggle exists yet, so `next-themes` is pinned to
 * light rather than left to detect the system preference.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NuqsAdapter>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
