/**
 * Plain-text extraction from CV files (PDF, DOCX), used to build the anonymised
 * version shown to recruiters. Only the visible body text is kept: images (the
 * photo), document properties (author, company…), headers and footers (where the
 * name and contact details usually sit) and the file name are never read.
 *
 * Runs on files that already passed src/lib/files/validate.ts (signature, active
 * content, archive bombs); limits below still bound the work.
 */
import { inflateRawSync } from "node:zlib";
import { readZipCentralDirectory } from "./validate";

export const MAX_EXTRACTED_CHARS = 30_000;
const MAX_PDF_PAGES = 10;
const MAX_DOCX_XML_BYTES = 8 * 1024 * 1024;

export class TextExtractionError extends Error {}

export async function extractPdfText(buf: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  // pdf.js may transfer (detach) the buffer it receives: give it a copy.
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  try {
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
          .join("")
          .trim(),
      );
      if (pages.join("\n\n").length > MAX_EXTRACTED_CHARS) break;
    }
    return pages.filter(Boolean).join("\n\n");
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** Reads one entry of a ZIP archive (stored or deflated), bounded in size. */
function readZipEntry(buf: Uint8Array, name: string): Buffer | null {
  const entries = readZipCentralDirectory(buf);
  const entry = entries?.find((e) => e.name === name);
  if (!entry) return null;
  if (entry.encrypted || entry.uncompressedSize > MAX_DOCX_XML_BYTES) throw new TextExtractionError("entry_too_large");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const p = entry.localHeaderOffset;
  if (p + 30 > buf.length || view.getUint32(p, true) !== 0x04034b50) throw new TextExtractionError("corrupted");
  const start = p + 30 + view.getUint16(p + 26, true) + view.getUint16(p + 28, true);
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method !== 8) throw new TextExtractionError("unsupported_compression");
  return inflateRawSync(data, { maxOutputLength: MAX_DOCX_XML_BYTES });
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return XML_ENTITIES[e] ?? m;
  });
}

/** Visible text of a WordprocessingML body (word/document.xml): runs, tabs, line and paragraph breaks. */
export function wordXmlToText(xml: string): string {
  const body = xml
    // Text boxes are stored twice (DrawingML and a VML fallback): keep one copy.
    .replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, "")
    // Deleted revisions are not part of the visible text.
    .replace(/<w:del\b[\s\S]*?<\/w:del>/g, "");
  // Field instructions (<w:instrText>) and tab-stop definitions (<w:tab w:pos=…/>) are not text.
  const TOKEN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>/g;
  let out = "";
  for (const m of body.matchAll(TOKEN)) {
    if (m[1] !== undefined) out += decodeXml(m[1]);
    else out += m[0] === "<w:tab/>" ? "\t" : "\n";
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function extractDocxText(buf: Uint8Array): string {
  const xml = readZipEntry(buf, "word/document.xml");
  if (!xml) throw new TextExtractionError("not_a_word_document");
  return wordXmlToText(xml.toString("utf8"));
}

/** Text of a validated CV file, trimmed to MAX_EXTRACTED_CHARS. Empty for image-only PDFs. */
export async function extractCvText(buf: Uint8Array, type: "pdf" | "docx"): Promise<string> {
  const text = type === "pdf" ? await extractPdfText(buf) : extractDocxText(buf);
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .slice(0, MAX_EXTRACTED_CHARS)
    .trim();
}
