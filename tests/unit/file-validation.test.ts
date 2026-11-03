import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkFile, detectType, sanitizeFilename } from "@/lib/files/validate";

const fx = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, "../fixtures", name)));
const MAX = 4 * 1024 * 1024;

describe("CV file validation", () => {
  it("accepts a valid PDF and a valid DOCX, deriving the MIME type from the signature", () => {
    const pdf = checkFile(fx("cv-valid.pdf"), ["pdf", "docx"], MAX);
    expect(pdf).toMatchObject({ ok: true, type: "pdf", mimeType: "application/pdf" });
    expect(pdf.sha256).toMatch(/^[0-9a-f]{64}$/);
    const docx = checkFile(fx("cv-valid.docx"), ["pdf", "docx"], MAX);
    expect(docx).toMatchObject({ ok: true, type: "docx" });
  });

  it("rejects files whose content does not match an allowed type, whatever the extension", () => {
    expect(checkFile(fx("fake-pdf.pdf"), ["pdf", "docx"], MAX)).toMatchObject({ ok: false, reason: "type_not_allowed" });
    expect(checkFile(fx("not-a-cv.txt"), ["pdf", "docx"], MAX)).toMatchObject({ ok: false, reason: "type_not_allowed" });
  });

  it("rejects PDFs with active content, including obfuscated names", () => {
    expect(checkFile(fx("cv-javascript.pdf"), ["pdf"], MAX)).toMatchObject({ ok: false, reason: "active_content" });
    expect(checkFile(fx("cv-obfuscated-js.pdf"), ["pdf"], MAX)).toMatchObject({ ok: false, reason: "active_content" });
    expect(checkFile(fx("cv-launch.pdf"), ["pdf"], MAX)).toMatchObject({ ok: false, reason: "active_content", details: ["launch_action"] });
  });

  it("rejects encrypted PDFs", () => {
    expect(checkFile(fx("cv-encrypted.pdf"), ["pdf"], MAX)).toMatchObject({ ok: false, reason: "encrypted" });
  });

  it("rejects DOCX with macros, embedded OLE objects or abnormal compression ratios", () => {
    expect(checkFile(fx("cv-macro.docx"), ["docx"], MAX)).toMatchObject({ ok: false, reason: "macros" });
    expect(checkFile(fx("cv-ole.docx"), ["docx"], MAX)).toMatchObject({ ok: false, reason: "embedded_objects" });
    expect(checkFile(fx("cv-bomb.docx"), ["docx"], MAX)).toMatchObject({ ok: false, reason: "archive_bomb" });
  });

  it("enforces size limits and empty files", () => {
    expect(checkFile(new Uint8Array(), ["pdf"], MAX)).toMatchObject({ ok: false, reason: "empty" });
    expect(checkFile(fx("cv-valid.pdf"), ["pdf"], 100)).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("rejects a truncated PDF", () => {
    const buf = fx("cv-valid.pdf");
    expect(checkFile(buf.slice(0, buf.length - 20), ["pdf"], MAX)).toMatchObject({ ok: false, reason: "corrupted" });
  });

  it("detects image signatures", () => {
    expect(detectType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(detectType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  });

  it("sanitises display file names", () => {
    expect(sanitizeFilename("../../etc/passwd", "pdf")).toBe("etc_passwd.pdf");
    expect(sanitizeFilename("..\\..\\cv..pdf", "pdf")).toBe("cv.pdf");
    expect(sanitizeFilename("CV Amélie <script>.pdf", "pdf")).toBe("CV Amelie _script_.pdf");
    expect(sanitizeFilename("", "docx")).toBe("document.docx");
  });
});
