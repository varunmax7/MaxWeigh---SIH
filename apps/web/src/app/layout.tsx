import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
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
  themeColor: '#1a2560',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
