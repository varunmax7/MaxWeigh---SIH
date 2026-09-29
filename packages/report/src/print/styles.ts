/**
 * Print CSS for the report document (implementation.md §8.2).
 *
 * `@page` sets the A4 sheet and margins the header/footer templates (set by
 * the worker's Playwright call, not by this stylesheet) print into. Table
 * headers repeat on every page (`thead { display: table-header-group }`)
 * and `break-inside: avoid` keeps a table row or a chart from splitting
 * across a page boundary — both meaningless on screen, so they live under
 * `@media print` even though the same route also serves the live preview.
 *
 * Colours read the app's own design tokens (`--pass`, `--fail`, `--seal`,
 * …) via `var()` rather than literal hex, so this file complies with §11's
 * "design tokens only, no raw hex outside globals.css" even though it lives
 * in a package that never sees `globals.css` itself — the print route that
 * renders it is what supplies the tokens, the same way any other page does.
 * `print-color-adjust: exact` keeps Playwright's PDF capture from dropping
 * to greyscale, since a verdict chip's colour is part of what the page
 * communicates, not decoration.
 */
export const PRINT_CSS = `
  @page {
    size: A4;
    margin: 18mm 16mm 20mm;
  }

  .tula-report {
    color-scheme: light;
    background: var(--background, #f4f6fa);
    color: var(--foreground, #161c2d);
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
  }

  .tula-report * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .tula-report table {
    border-collapse: collapse;
    width: 100%;
  }

  .tula-report td,
  .tula-report th {
    padding: 0.8mm 2.5mm 0.8mm 0;
    vertical-align: top;
  }

  .tula-report thead {
    display: table-header-group;
  }

  .tula-report thead th {
    border-bottom: 0.4pt solid var(--border, #dce1ea);
  }

  .tula-report tbody tr:not(:last-child) td {
    border-bottom: 0.2pt solid var(--border, #dce1ea);
  }

  .tula-report tr,
  .tula-report .avoid-break {
    break-inside: avoid;
  }

  .tula-report .page-break-before {
    break-before: page;
  }

  .tula-report .tabular {
    font-variant-numeric: tabular-nums;
  }

  .tula-report .mono {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
  }

  @media screen {
    .tula-report {
      max-width: 210mm;
      margin: 0 auto;
      padding: 18mm 16mm 20mm;
      box-shadow: 0 0 0 1px var(--border, #dce1ea);
    }
  }

  .tula-watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 999;
  }

  .tula-watermark span {
    transform: rotate(-32deg);
    font-size: 72pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--fail, #b42318);
    opacity: 0.16;
    white-space: nowrap;
  }
`;
