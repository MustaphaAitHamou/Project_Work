import { describe, expect, it } from "vitest";
import { nameVariants, redactPersonalData, redactionTotal, type RedactionLabels } from "@/lib/privacy/redact";

const labels: RedactionLabels = {
  name: "[nom]",
  email: "[e-mail]",
  phone: "[tél]",
  link: "[lien]",
  address: "[adresse]",
  birth: "[naissance]",
  age: "[âge]",
  personal: "[perso]",
};

// A CV packed with personal data, as text extracted from a PDF.
const CV_FR = `Amélie DURAND-LEFÈVRE
Développeuse React / TypeScript
Mme Amélie Durand-Lefèvre, 34 ans, mariée, 2 enfants
12 rue de la Paix, 75002 Paris
Tél. : +33 6 12 34 56 78 — 06.12.34.56.78
amelie.durand@gmail.com · linkedin.com/in/amelie-durand · https://amelie.dev · @ameliedev
Née le 14/03/1990 à Lyon
Nationalité : française
Situation familiale : mariée

EXPÉRIENCES
2018-2021 — Développeuse front-end, Hamounet SAS, Lyon
01/2021-06/2024 — Lead développeuse, Durandal Conseil
Encadrement de 4 personnes, 10 ans d'expérience en React, budget de 45 000 €.

FORMATION
Master informatique — Université Lyon 1 (2013)
Permis B`;

describe("redactPersonalData", () => {
  const result = redactPersonalData(CV_FR, {
    names: ["Amélie", "Durand-Lefèvre"],
    knownValues: ["amelie.durand@gmail.com", "06 12 34 56 78"],
    labels,
  });
  const text = result.text;

  it("removes names in any case and accentuation, including parts of compound names", () => {
    expect(text).not.toMatch(/amélie|amelie|durand-lef|lefèvre|lefevre/i);
    expect(text.split("\n")[0]).toBe("[nom]");
  });

  it("keeps words that only contain a name (company names, other words)", () => {
    expect(text).toContain("Durandal Conseil");
    expect(text).toContain("Hamounet SAS");
  });

  it("removes contact details and links", () => {
    expect(text).not.toMatch(/@gmail|12 34 56 78|12\.34\.56\.78|linkedin|amelie\.dev|@ameliedev/i);
    expect(text).toContain("[e-mail]");
    expect(text).toContain("[tél]");
    expect(text).toContain("[lien]");
  });

  it("removes the postal address", () => {
    expect(text).not.toMatch(/rue de la Paix|75002/);
    expect(text).toContain("[adresse]");
  });

  it("removes birth date, age, gender, nationality and family status", () => {
    expect(text).not.toMatch(/14\/03\/1990|34 ans|française|mariée|2 enfants|Mme/);
    expect(text).toContain("Nationalité : [perso]");
    expect(text).toContain("Situation familiale : [perso]");
    expect(text).toContain("[naissance]");
  });

  it("keeps the professional content: periods, skills, experience, numbers that are not identifiers", () => {
    expect(text).toContain("2018-2021 — Développeuse front-end");
    expect(text).toContain("01/2021-06/2024 — Lead développeuse");
    expect(text).toContain("10 ans d'expérience en React, budget de 45 000 €");
    expect(text).toContain("Master informatique — Université Lyon 1 (2013)");
    expect(text).toContain("Permis B");
  });

  it("reports what was hidden without the hidden values", () => {
    expect(result.counts.name).toBe(2);
    expect(result.counts.email).toBeGreaterThanOrEqual(1);
    expect(result.counts.phone).toBeGreaterThanOrEqual(2);
    expect(redactionTotal(result.counts)).toBeGreaterThan(10);
    expect(JSON.stringify(result.counts)).not.toMatch(/amelie|0612/i);
  });

  it("is idempotent on its own output", () => {
    const again = redactPersonalData(text, { names: ["Amélie", "Durand-Lefèvre"], labels });
    expect(again.text).toBe(text);
    expect(redactionTotal(again.counts)).toBe(0);
  });
});

describe("redactPersonalData — other languages and formats", () => {
  it("handles an English CV", () => {
    const { text } = redactPersonalData(
      `John O'Neil
Senior Data Engineer
Date of birth: 2 May 1988 · Gender: male · Marital status: single
Address: 221B Baker Street, London NW1 6XE
(514) 555-1234 · john.oneil@example.org · github.com/joneil
Born in Dublin, aged 36.
2019 - 2024 Data engineer at Contoso (Python, Spark)`,
      { names: ["John", "O'Neil"], labels },
    );
    expect(text).not.toMatch(/John|O'Neil|1988|male|single|Baker|NW1|555|example\.org|joneil|Dublin|36/);
    expect(text).toContain("2019 - 2024 Data engineer at Contoso (Python, Spark)");
  });

  it("handles a Spanish CV and identity numbers", () => {
    const { text } = redactPersonalData(
      `María José Pérez
Fecha de nacimiento: 3 de julio de 1992
DNI: 12345678Z
Nacionalidad: española
Calle Mayor 5, 28013 Madrid
Ingeniera de software en Telefónica (2016-2023)`,
      { names: ["María José", "Pérez"], labels },
    );
    expect(text).not.toMatch(/María|Maria|Pérez|1992|12345678Z|española|Calle Mayor|28013/);
    expect(text).toContain("Ingeniera de software en Telefónica (2016-2023)");
  });

  it("does not mask a short or empty name and copes with empty text", () => {
    expect(redactPersonalData("", { names: ["", "A"], labels }).text).toBe("");
    expect(nameVariants(["A", " "])).toEqual([]);
  });

  it("never lets a name match inside a label (names that look like label words)", () => {
    const { text } = redactPersonalData("Liên Nguyen — lien@example.com", {
      names: ["Liên", "Nguyen"],
      labels: { ...labels, email: "[lien masqué]" },
    });
    expect(text).toBe("[nom] — [lien masqué]");
  });

  it("builds name variants longest first", () => {
    expect(nameVariants(["Jean-Pierre", "Aït Hamou"])).toEqual([
      "Jean-Pierre Aït Hamou",
      "Jean-Pierre",
      "Aït Hamou",
      "Pierre",
      "Hamou",
      "Jean",
      "Aït",
    ]);
  });
});
