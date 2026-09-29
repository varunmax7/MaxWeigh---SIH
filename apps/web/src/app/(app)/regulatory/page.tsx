import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell/PageHeader';

export const metadata: Metadata = { title: 'Standards library' };

interface StandardEntry {
  title: string;
  edition: string;
  summary: string;
  /** Only set for a domain this app is confident linking to (implementation.md §11's "never guess URLs" — see docs/QUESTIONS.md). */
  href?: string;
}

const STANDARDS: StandardEntry[] = [
  {
    title: 'OIML R 76-1',
    edition: '2006',
    summary:
      'Metrological requirements for non-automatic weighing instruments: accuracy classes, maximum permissible errors, and the test procedures this app’s engine implements (weighing, eccentricity, discrimination, repeatability, and the rest of the catalogue). The rule pack this app runs against (oiml-r76-1-2006) transcribes its tables and limits directly.',
    href: 'https://www.oiml.org',
  },
  {
    title: 'OIML R 76-2',
    edition: '2007',
    summary:
      'The companion test report format for R 76-1 — clause order, required sections, and what a certificate of conformity must state. This app’s report templates follow its structure.',
    href: 'https://www.oiml.org',
  },
  {
    title: 'OIML R 111-1',
    edition: '2004',
    summary:
      'Metrological and technical requirements for weights of classes E1–M3, including the maximum-permissible-error table this app uses to judge whether a lab’s reference weight set is adequate for a given test.',
    href: 'https://www.oiml.org',
  },
  {
    title: 'Legal Metrology Act',
    edition: '2009',
    summary:
      'The Indian parent statute establishing legal metrology control, including model approval, verification, and enforcement — the legal basis under which a Regional Reference Standards Laboratory issues a type-approval test report.',
  },
  {
    title: 'Legal Metrology (General) Rules',
    edition: '2011',
    summary:
      'General rules made under the Act covering weighing and measuring instrument categories, verification marks, and licensing — the broader regulatory context a test report sits inside.',
  },
  {
    title: 'Legal Metrology (Approval of Models) Rules',
    edition: '2011',
    summary:
      'The specific rules governing model approval applications — the process this app’s evaluation workflow (intake → testing → tiered review → issue) is built to support.',
  },
];

/**
 * Standards library (implementation.md §7.5): paraphrased summaries only —
 * never copied normative text (§11) — with an official link where this
 * environment is confident one is correct (oiml.org's root domain; not a
 * specific document URL it can't verify). The three Indian legal-metrology
 * instruments are named without a link — see docs/QUESTIONS.md, which asks
 * a human to supply and verify the actual Department of Consumer Affairs
 * URLs before this page links to them.
 */
export default function RegulatoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Standards library"
        description="The standards this app's engine and workflow are built against — paraphrased for engineering reference, not a substitute for the official text."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {STANDARDS.map((standard) => (
          <div
            key={standard.title}
            className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{standard.title}</h2>
              <span className="tabular text-xs text-muted-foreground">{standard.edition}</span>
            </div>
            <p className="text-sm text-muted-foreground">{standard.summary}</p>
            {standard.href ? (
              <a
                href={standard.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Official source <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                Official text: Department of Consumer Affairs, Government of India.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
