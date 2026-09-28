/**
 * Renders an `Issue` (`@tula/engine`'s `code` + `params`) into sentence-case
 * prose (implementation.md §7.8, §11: "code + params render the message in
 * the UI — never bake user-facing text in [the engine]"). The clause itself
 * is shown separately from `issue.clause`, never copied into the sentence —
 * §7.8: "Do not paste OIML normative text into the UI; paraphrase and cite
 * the clause."
 */
import type { Issue } from '@tula/engine';

type MessageBuilder = (params: Record<string, string>) => string;

const MESSAGES: Record<string, MessageBuilder> = {
  CLS_E_FORM: (p) =>
    `Range ${p.range}: ${p.e ? `e (${p.e})` : `d (${p.d})`} must be 1, 2 or 5 × 10ᵏ.`,
  CLS_D_EXCEEDS_E: (p) => `Range ${p.range}: d (${p.d}) cannot be greater than e (${p.e}).`,
  CLS_AUX_NOT_ALLOWED: (p) =>
    `Auxiliary indication (d < e) is only allowed for classes I and II — this instrument is class ${p.class}.`,
  CLS_AUX_E_FORM: (p) => `With auxiliary indication, e (${p.e}) must be a power of ten in kg.`,
  CLS_AUX_RATIO: (p) => `e/d (${p.e} / ${p.d}) exceeds the maximum ratio of ${p.maxRatio}.`,
  CLS_E_RANGE: (p) => `e (${p.e}) is outside any classification band for class ${p.class}.`,
  CLS_N_LOW: (p) => `n = Max/e is ${p.n}, below the minimum of ${p.nMin} for this class and band.`,
  CLS_N_HIGH: (p) => `n = Max/e is ${p.n}, above the maximum of ${p.nMax} for this class and band.`,
  CLS_MIN_LOW: (p) => `Min (${p.min}) is below the required lower limit of ${p.lowerLimit}.`,
  CLS_RANGE_E_NOT_INCREASING: (p) =>
    `Range ${p.range}: e must be greater than the previous range's e.`,
  CLS_RANGE_MAX_NOT_ASCENDING: (p) =>
    `Range ${p.range}: Max must be greater than the previous range's Max.`,
  CLS_ZERO_RANGE_SUPPL: (p) =>
    `Initial zero-setting range is ${p.pct}% of Max, over 20% — the supplementary weighing test will apply.`,
};

/** A generic fallback so an unrecognised code still shows something, not a blank. */
function fallbackMessage(issue: Issue): string {
  const params = Object.entries(issue.params)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return `${issue.code}${params ? ` (${params})` : ''}`;
}

export function issueMessage(issue: Issue): string {
  const build = MESSAGES[issue.code];
  return build ? build(issue.params) : fallbackMessage(issue);
}
