/**
 * Builds small but realistic PDF and DOCX files for tests (no binary fixtures to
 * maintain): a PDF with one text line per row, a DOCX with header, footer,
 * document properties, a text box and a deleted revision.
 */
import { deflateRawSync } from "node:zlib";

/** CRC-32 (ZIP). */
function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

export function buildZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, "utf8");
    const packed = deflateRawSync(data);
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, packed);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (text: string) => `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="2000"/></w:tabs></w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

export function buildDocx(opts: { body: string[]; header?: string; footer?: string; author?: string; textBox?: string; deleted?: string }): Buffer {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
  const textBox = opts.textBox
    ? `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><w:txbxContent>${para(opts.textBox)}</w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent>${para(opts.textBox)}</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`
    : "";
  const deleted = opts.deleted ? `<w:p><w:del w:id="1" w:author="x"><w:r><w:delText>${esc(opts.deleted)}</w:delText></w:r></w:del></w:p>` : "";
  const body = opts.body.map(para).join("") + textBox + deleted;
  return buildZip({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
    ...(opts.header ? { "word/header1.xml": `<w:hdr ${W}>${para(opts.header)}</w:hdr>` } : {}),
    ...(opts.footer ? { "word/footer1.xml": `<w:ftr ${W}>${para(opts.footer)}</w:ftr>` } : {}),
    ...(opts.author
      ? { "docProps/core.xml": `<cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>${esc(opts.author)}</dc:creator></cp:coreProperties>` }
      : {}),
  });
}

/** Latin-1 PDF string literal: (, ) and \ escaped, accented letters as octal escapes. */
function pdfString(s: string): string {
  return [...s]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (ch === "(" || ch === ")" || ch === "\\") return `\\${ch}`;
      if (code > 126 && code < 256) return `\\${code.toString(8).padStart(3, "0")}`;
      return code < 256 ? ch : "?";
    })
    .join("");
}

export function buildPdf(lines: string[], opts: { author?: string } = {}): Buffer {
  const content = ["BT", "/F1 11 Tf", "14 TL", "56 790 Td", ...lines.map((l) => `(${pdfString(l)}) Tj T*`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    `<< /Author (${pdfString(opts.author ?? "")}) /Title (CV) >>`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
