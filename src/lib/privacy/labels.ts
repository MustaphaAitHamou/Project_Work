import { REDACTION_CATEGORIES, type RedactionCategory, type RedactionLabels } from "./redact";

/** Replacement labels in the reader's language, from the "anonymity.labels" messages. */
export function redactionLabels(t: (key: `labels.${RedactionCategory}`) => string): RedactionLabels {
  return Object.fromEntries(REDACTION_CATEGORIES.map((c) => [c, t(`labels.${c}`)])) as RedactionLabels;
}
