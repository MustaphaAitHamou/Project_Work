/**
 * Server-side validation of uploaded files. Never trust the browser-declared MIME
 * type or extension: the type is derived from the file signature ("magic bytes")
 * and the structure is inspected for active content.
 *
 * Limits of this approach (documented in docs/SECURITY.md): content hidden in
 * compressed PDF object streams cannot be fully inspected without a PDF parser;
 * an antivirus engine (e.g. ClamAV) can be added in front for defence in depth.
 */
import { createHash } from "node:crypto";

export type DetectedType = "pdf" | "docx" | "png" | "jpeg" | "webp" | "unknown";

export type FileRejection =
  | "empty"
  | "too_large"
  | "type_not_allowed"
  | "corrupted"
  | "encrypted"
  | "active_content"
  | "macros"
  | "embedded_objects"
  | "archive_bomb";

export interface FileCheckResult {
  ok: boolean;
  type: DetectedType;
  mimeType?: string;
  reason?: FileRejection;
  details?: string[];
  sha256: string;
  size: number;
}

export const MIME_BY_TYPE: Record<Exclude<DetectedType, "unknown">, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function sha256(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

function startsWith(buf: Uint8Array, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return sig.every((b, i) => buf[offset + i] === b);
}

export function detectType(buf: Uint8Array): DetectedType {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return "docx"; // ZIP container, confirmed by inspectDocx
  const head = Buffer.from(buf.subarray(0, Math.min(buf.length, 1024))).toString("latin1");
  if (head.includes("%PDF-")) return "pdf";
  return "unknown";
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
const PDF_DANGEROUS_NAMES: Array<[RegExp, string]> = [
  [/\/JavaScript\b/, "javascript"],
  [/\/JS[\s(<\/[]/, "javascript"],
  [/\/Launch\b/, "launch_action"],
  [/\/EmbeddedFiles?\b/, "embedded_file"],
  [/\/RichMedia\b/, "rich_media"],
  [/\/XFA\b/, "xfa_form"],
  [/\/SubmitForm\b/, "submit_form"],
  [/\/ImportData\b/, "import_data"],
  [/\/GoToR\b/, "remote_goto"],
];

/** Decodes "#xx" escapes used to obfuscate PDF names (e.g. /J#61vaScript). */
function decodePdfNameEscapes(text: string): string {
  return text.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export function inspectPdf(buf: Uint8Array): { ok: boolean; reason?: FileRejection; details: string[] } {
  const text = decodePdfNameEscapes(Buffer.from(buf).toString("latin1"));
  const head = text.slice(0, 1024);
  if (!/%PDF-\d\.\d/.test(head)) return { ok: false, reason: "corrupted", details: ["missing_header"] };
  if (!text.slice(-4096).includes("%%EOF")) return { ok: false, reason: "corrupted", details: ["missing_eof"] };
  if (/\/Encrypt\b/.test(text)) return { ok: false, reason: "encrypted", details: ["encrypted"] };
  const found = new Set<string>();
  for (const [re, label] of PDF_DANGEROUS_NAMES) if (re.test(text)) found.add(label);
  if (found.size > 0) return { ok: false, reason: "active_content", details: [...found] };
  return { ok: true, details: [] };
}

// ---------------------------------------------------------------------------
// DOCX (Office Open XML in a ZIP container) — central directory inspection only,
// nothing is extracted to disk.
// ---------------------------------------------------------------------------
export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  encrypted: boolean;
}

export function readZipCentralDirectory(buf: Uint8Array): ZipEntry[] | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const minEocd = 22;
  if (buf.length < minEocd) return null;
  let eocd = -1;
  for (let i = buf.length - minEocd; i >= Math.max(0, buf.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const totalEntries = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (cdOffset + cdSize > buf.length || totalEntries === 0xffff) return null; // ZIP64 not expected for CVs
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < totalEntries; n++) {
    if (p + 46 > buf.length || view.getUint32(p, true) !== 0x02014b50) return null;
    const flags = view.getUint16(p + 8, true);
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    if (p + 46 + nameLen > buf.length) return null;
    const name = Buffer.from(buf.subarray(p + 46, p + 46 + nameLen)).toString("utf8");
    entries.push({ name, compressedSize, uncompressedSize, encrypted: (flags & 0x1) === 1 });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export const DOCX_LIMITS = { maxEntries: 1000, maxTotalUncompressed: 50 * 1024 * 1024, maxRatio: 150 };

export function inspectDocx(buf: Uint8Array): { ok: boolean; reason?: FileRejection; details: string[] } {
  const entries = readZipCentralDirectory(buf);
  if (!entries) return { ok: false, reason: "corrupted", details: ["invalid_zip"] };
  const names = entries.map((e) => e.name);
  if (!names.includes("[Content_Types].xml") || !names.includes("word/document.xml")) {
    return { ok: false, reason: "type_not_allowed", details: ["not_a_word_document"] };
  }
  if (entries.some((e) => e.encrypted)) return { ok: false, reason: "encrypted", details: ["encrypted_entries"] };
  if (names.some((n) => n.includes("..") || n.startsWith("/") || n.includes("\\"))) {
    return { ok: false, reason: "corrupted", details: ["suspicious_paths"] };
  }
  if (names.some((n) => /vbaProject|vbaData/i.test(n))) return { ok: false, reason: "macros", details: ["vba_project"] };
  const embedded = names.filter((n) => /^word\/(embeddings|activeX)\//i.test(n) || /oleObject/i.test(n));
  if (embedded.length > 0) return { ok: false, reason: "embedded_objects", details: embedded.slice(0, 5) };
  const total = entries.reduce((s, e) => s + e.uncompressedSize, 0);
  if (entries.length > DOCX_LIMITS.maxEntries || total > DOCX_LIMITS.maxTotalUncompressed) {
    return { ok: false, reason: "archive_bomb", details: ["too_large_uncompressed"] };
  }
  const bomb = entries.find((e) => e.uncompressedSize > 1024 * 1024 && e.uncompressedSize / Math.max(e.compressedSize, 1) > DOCX_LIMITS.maxRatio);
  if (bomb) return { ok: false, reason: "archive_bomb", details: [`ratio:${bomb.name}`] };
  return { ok: true, details: [] };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export function checkFile(buf: Uint8Array, allowed: readonly DetectedType[], maxBytes: number): FileCheckResult {
  const size = buf.byteLength;
  const digest = sha256(buf);
  const base = { sha256: digest, size };
  if (size === 0) return { ...base, ok: false, type: "unknown", reason: "empty" };
  if (size > maxBytes) return { ...base, ok: false, type: "unknown", reason: "too_large" };
  const type = detectType(buf);
  if (type === "unknown" || !allowed.includes(type)) return { ...base, ok: false, type, reason: "type_not_allowed" };
  if (type === "pdf") {
    const r = inspectPdf(buf);
    if (!r.ok) return { ...base, ok: false, type, reason: r.reason, details: r.details };
  }
  if (type === "docx") {
    const r = inspectDocx(buf);
    if (!r.ok) return { ...base, ok: false, type, reason: r.reason, details: r.details };
  }
  return { ...base, ok: true, type, mimeType: MIME_BY_TYPE[type] };
}

/** Keeps a readable, safe file name (used only as display / download name). */
export function sanitizeFilename(name: string, fallbackExt: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.{2,}/g, ".")
    .trim()
    .replace(/^[._ ]+/, "");
  const withoutExt = base.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, 100) || "document";
  return `${withoutExt}.${fallbackExt}`;
}
