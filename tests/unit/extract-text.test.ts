import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCvText, wordXmlToText } from "@/lib/files/extract-text";
import { checkFile } from "@/lib/files/validate";
import { buildAnonymizedCv } from "@/lib/privacy/anonymized-cv";
import { buildDocx, buildPdf } from "../helpers/documents";

const labels = {
  name: "[nom masqué]",
  email: "[e-mail masqué]",
  phone: "[téléphone masqué]",
  link: "[lien masqué]",
  address: "[adresse masquée]",
  birth: "[date de naissance masquée]",
  age: "[âge masqué]",
  personal: "[information personnelle masquée]",
};
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, "../fixtures", name)));

describe("CV text extraction", () => {
  it("reads the text of the PDF and DOCX fixtures", async () => {
    expect(await extractCvText(fixture("cv-valid.pdf"), "pdf")).toBe("Curriculum vitae - Test Candidate");
    expect(await extractCvText(fixture("cv-valid.docx"), "docx")).toBe("Curriculum vitae - Test Candidate");
  });

  it("keeps the lines of a PDF, accents included, and ignores the document properties", async () => {
    const pdf = buildPdf(["Samir Benali", "Technicien de maintenance", "Électricité, automatismes"], { author: "Samir Benali (auteur)" });
    expect(checkFile(pdf, ["pdf", "docx"], 4 * 1024 * 1024).ok).toBe(true);
    const text = await extractCvText(pdf, "pdf");
    expect(text.split("\n").map((l) => l.trim())).toEqual(["Samir Benali", "Technicien de maintenance", "Électricité, automatismes"]);
    expect(text).not.toContain("auteur");
  });

  it("reads only the body of a DOCX: no header, footer, properties, duplicate text box or deleted text", async () => {
    const docx = buildDocx({
      body: ["Chef de projet <digital> & produit", "Compétences\tScrum, Jira"],
      header: "Nadia Khelifi — 06 98 76 54 32",
      footer: "nadia@example.com",
      author: "Nadia Khelifi",
      textBox: "Langues : anglais, kabyle",
      deleted: "Ancienne adresse 3 rue des Lilas",
    });
    expect(checkFile(docx, ["pdf", "docx"], 4 * 1024 * 1024).ok).toBe(true);
    const text = await extractCvText(docx, "docx");
    expect(text).toBe("Chef de projet <digital> & produit\nCompétences\tScrum, Jira\nLangues : anglais, kabyle");
    expect(text).not.toMatch(/Nadia|Khelifi|06 98|example\.com|Lilas/);
  });

  it("decodes entities and line breaks of WordprocessingML", () => {
    expect(wordXmlToText('<w:p><w:r><w:t>A&amp;B &#233;t&#xE9;</w:t><w:br/><w:t xml:space="preserve"> suite</w:t></w:r></w:p><w:p><w:r><w:instrText>HYPERLINK "mailto:x@y.z"</w:instrText><w:t>fin</w:t></w:r></w:p>')).toBe(
      "A&B été\n suite\nfin",
    );
  });

  it("refuses a file that is not a Word document", async () => {
    await expect(extractCvText(buildPdf(["x"]).subarray(0, 0), "docx")).rejects.toThrow();
  });
});

describe("buildAnonymizedCv (extraction + removal of personal data)", () => {
  const owner = { firstName: "Samir", lastName: "Benali", email: "samir.benali@example.com", phone: "+33 6 11 22 33 44" };

  it("produces a draft without the owner's identifiers", async () => {
    const pdf = buildPdf([
      "Samir BENALI",
      "Technicien de maintenance industrielle",
      "06 11 22 33 44 - samir.benali@example.com",
      "Né le 02/05/1991 - Nationalité : algérienne",
      "2016-2024 Technicien, Usine Lactalis, Rennes",
    ]);
    const draft = await buildAnonymizedCv(pdf, "pdf", owner, labels);
    expect(draft.status).toBe("to_review");
    expect(draft.text).not.toMatch(/Samir|BENALI|06 11|example\.com|1991|algérienne/i);
    expect(draft.text).toContain("Technicien de maintenance industrielle");
    expect(draft.text).toContain("2016-2024 Technicien, Usine Lactalis, Rennes");
    expect(draft.counts.name).toBeGreaterThanOrEqual(1);
  });

  it("reports a file without readable text (scanned CV) as unavailable", async () => {
    const draft = await buildAnonymizedCv(buildPdf([]), "pdf", owner, labels);
    expect(draft).toEqual({ text: "", counts: {}, status: "unavailable" });
  });
});
