import { extractCvText } from "@/lib/files/extract-text";
import { redactPersonalData, type RedactionLabels, type RedactionResult } from "./redact";

export interface CvOwner {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

export interface AnonymizedCvDraft extends RedactionResult {
  /** "unavailable" when no text could be read (scanned or image-only file). */
  status: "to_review" | "unavailable";
}

/**
 * Builds the anonymised version of a CV: text of the body only (no photo, no file
 * name, no document properties), then removal of personal data. The candidate
 * reviews it before recruiters can read it.
 */
export async function buildAnonymizedCv(
  file: Uint8Array,
  type: "pdf" | "docx",
  owner: CvOwner,
  labels: RedactionLabels,
): Promise<AnonymizedCvDraft> {
  const raw = await extractCvText(file, type);
  if (!raw) return { text: "", counts: {}, status: "unavailable" };
  return { ...anonymizeCvText(raw, owner, labels), status: "to_review" };
}

export function anonymizeCvText(text: string, owner: CvOwner, labels: RedactionLabels): RedactionResult {
  return redactPersonalData(text, {
    names: [owner.firstName, owner.lastName],
    knownValues: [owner.email, owner.phone].filter((v): v is string => Boolean(v && v.trim())),
    labels,
  });
}
