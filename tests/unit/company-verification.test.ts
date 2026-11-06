/**
 * Verification engine. Registry answers below are FIXTURES written from the public
 * documentation of each API (field names and value conventions). They are not
 * recorded live responses: live validation is documented in docs/STATUS.md.
 */
import { describe, expect, it } from "vitest";
import { buildReport, decide, queryRegistries, type EngineConfig } from "@/lib/companies/verification/engine";
import { isFreeEmail, nameSimilarity, personMatches, registrableDomain } from "@/lib/companies/verification/matching";
import { parseRechercheEntreprises } from "@/lib/companies/verification/providers/fr-recherche-entreprises";
import { parseCompaniesHouse, ukOfficerName } from "@/lib/companies/verification/providers/uk-companies-house";
import { parseVies } from "@/lib/companies/verification/providers/eu-vies";
import { parseZefix } from "@/lib/companies/verification/providers/ch-zefix";
import { jurisdictionCode, parseOpenCorporates } from "@/lib/companies/verification/providers/opencorporates";
import type { VerificationInput } from "@/lib/companies/verification/types";

const frBody = {
  results: [
    {
      siren: "552100554",
      nom_complet: "ACME INDUSTRIE",
      nom_raison_sociale: "ACME INDUSTRIE",
      etat_administratif: "A",
      siege: { adresse: "1 RUE DE LA PAIX 75002 PARIS", code_postal: "75002", libelle_commune: "PARIS" },
      dirigeants: [
        { nom: "MARTIN", prenoms: "Karim Paul", qualite: "Président de SAS", type_dirigeant: "personne physique" },
        { denomination: "AUDIT CONSEIL", qualite: "Commissaire aux comptes titulaire", type_dirigeant: "personne morale" },
      ],
    },
  ],
  total_results: 1,
};

const input = (over: Partial<VerificationInput> = {}): VerificationInput => ({
  companyId: "c1",
  country: "FR",
  idType: "fr_siren",
  registrationNumber: "552100554",
  secondary: {},
  legalName: "Acme Industrie SAS",
  postalCode: "75002",
  website: "https://www.acme-industrie.fr",
  representative: { firstName: "Karim", lastName: "Martin", email: "karim.martin@acme-industrie.fr", emailConfirmed: true, isLegalRepresentative: true },
  ...over,
});

function fetcherReturning(status: number, body: unknown): EngineConfig["fetcher"] {
  return async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const cfg = (fetcher: EngineConfig["fetcher"]): EngineConfig => ({ fetcher, timeoutMs: 1000, frEnabled: true, viesEnabled: true });

describe("matching helpers", () => {
  it("compares company names without legal forms or accents", () => {
    expect(nameSimilarity("Acme Industrie SAS", "ACME INDUSTRIE")).toBeGreaterThanOrEqual(0.75);
    expect(nameSimilarity("Société Générale", "SOCIETE GENERALE SA")).toBeGreaterThanOrEqual(0.75);
    expect(nameSimilarity("Boulangerie Dupont", "Garage Martin")).toBeLessThan(0.45);
  });
  it("matches a representative against registry officers", () => {
    expect(personMatches("Karim", "Martin", "Karim Paul MARTIN")).toBe(true);
    expect(personMatches("Karim", "Martin", ukOfficerName("MARTIN, Karim"))).toBe(true);
    expect(personMatches("Karim", "Durand", "Karim Paul MARTIN")).toBe(false);
  });
  it("detects free e-mail providers and registrable domains", () => {
    expect(isFreeEmail("someone@gmail.com")).toBe(true);
    expect(isFreeEmail("rh@acme.fr")).toBe(false);
    expect(registrableDomain("www.jobs.acme.co.uk")).toBe("acme.co.uk");
  });
});

describe("registry parsers (documentation-based fixtures)", () => {
  it("France: recherche-entreprises", () => {
    const r = parseRechercheEntreprises("552100554", frBody);
    expect(r).toMatchObject({ found: true, active: true, legalName: "ACME INDUSTRIE", address: { postalCode: "75002" } });
    expect(r.officers).toEqual([
      { name: "Karim Paul MARTIN", role: "Président de SAS" },
      { name: "AUDIT CONSEIL", role: "Commissaire aux comptes titulaire" },
    ]);
    expect(parseRechercheEntreprises("000000000", frBody)).toEqual({ found: false, active: null });
  });
  it("United Kingdom: Companies House profile and officers", () => {
    const r = parseCompaniesHouse(
      { company_name: "ACME LTD", company_number: "00000006", company_status: "dissolved", registered_office_address: { address_line_1: "1 High St", locality: "London", postal_code: "EC1A 1BB" } },
      { items: [{ name: "SMITH, Jane", officer_role: "director" }, { name: "OLD, Bob", officer_role: "director", resigned_on: "2020-01-01" }] },
    );
    expect(r).toMatchObject({ found: true, active: false, legalName: "ACME LTD", officers: [{ name: "Jane SMITH", role: "director" }] });
  });
  it("EU VIES: name hidden by some member states, service errors", () => {
    expect(parseVies({ isValid: true, name: "---", address: "---" })).toMatchObject({ found: true, active: true, legalName: undefined });
    expect(parseVies({ isValid: false, userError: "INVALID" })).toMatchObject({ found: false });
    expect(parseVies({ userError: "MS_UNAVAILABLE" })).toBe("unavailable");
  });
  it("Switzerland: Zefix and OpenCorporates", () => {
    expect(parseZefix([{ name: "Muster AG", uid: "CHE123456788", status: "CANCELLED", legalSeat: "Zürich" }])).toMatchObject({ found: true, active: false });
    expect(parseOpenCorporates({ results: { company: { name: "ACME INC.", inactive: false, officers: [{ officer: { name: "JANE DOE", position: "president" } }] } } })).toMatchObject({
      found: true,
      active: true,
      officers: [{ name: "JANE DOE", role: "president" }],
    });
    expect(jurisdictionCode("US", "DE")).toBe("us_de");
    expect(jurisdictionCode("CA", null, "ca_neq")).toBe("ca_qc");
  });
});

describe("verification decisions", () => {
  it("all strong checks + auto-approval enabled -> verified", async () => {
    const outcomes = await queryRegistries(input(), cfg(fetcherReturning(200, frBody)));
    const report = buildReport(input(), outcomes);
    expect(report.checks.every((c) => c.result === "pass")).toBe(true);
    expect(decide(report, true)).toEqual({ outcome: "verified", messageKey: "verified" });
    // Being listed in the registry is not sufficient while automatic approval is off.
    expect(decide(report, false)).toEqual({ outcome: "manual_review", messageKey: "manual_review" });
  });

  it("a ceased company is rejected", async () => {
    const ceased = { results: [{ ...frBody.results[0], etat_administratif: "C" }] };
    const report = buildReport(input(), await queryRegistries(input(), cfg(fetcherReturning(200, ceased))));
    expect(decide(report, true)).toEqual({ outcome: "rejected", messageKey: "inactive" });
  });

  it("a fake (unknown) company goes to manual review, never auto-verified", async () => {
    const report = buildReport(input({ registrationNumber: "732829320" }), await queryRegistries(input({ registrationNumber: "732829320" }), cfg(fetcherReturning(200, { results: [] }))));
    expect(report.riskFlags).toContain("registry_not_found");
    expect(decide(report, true)).toEqual({ outcome: "manual_review", messageKey: "not_found" });
  });

  it("someone who is not a listed officer must prove their authority", async () => {
    const i = input({ representative: { firstName: "Paul", lastName: "Leroy", email: "paul@acme-industrie.fr", emailConfirmed: true, isLegalRepresentative: false } });
    const report = buildReport(i, await queryRegistries(i, cfg(fetcherReturning(200, frBody))));
    expect(decide(report, true)).toEqual({ outcome: "manual_review", messageKey: "needs_authority" });
  });

  it("free e-mail or another domain prevents automatic approval", async () => {
    const i = input({ representative: { firstName: "Karim", lastName: "Martin", email: "karim.martin@gmail.com", emailConfirmed: true, isLegalRepresentative: true } });
    const report = buildReport(i, await queryRegistries(i, cfg(fetcherReturning(200, frBody))));
    expect(report.riskFlags).toEqual(expect.arrayContaining(["free_email", "domain_mismatch"]));
    expect(decide(report, true).outcome).toBe("manual_review");
  });

  it("registry outage or missing API leads to manual review", async () => {
    const down = buildReport(input(), await queryRegistries(input(), cfg(fetcherReturning(503, {}))));
    expect(decide(down, true)).toEqual({ outcome: "manual_review", messageKey: "registry_unavailable" });
    const dz = input({ country: "DZ", idType: "dz_rc", registrationNumber: "16/00-1234567B12" });
    const noApi = buildReport(dz, await queryRegistries(dz, cfg(fetcherReturning(200, {}))));
    expect(decide(noApi, true)).toEqual({ outcome: "manual_review", messageKey: "needs_documents" });
  });

  it("a timeout is reported as unavailable, not as a failure", async () => {
    const slow: EngineConfig["fetcher"] = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }))));
    const outcomes = await queryRegistries(input(), { ...cfg(slow), timeoutMs: 50 });
    expect(outcomes[0]).toMatchObject({ status: "unavailable", reason: "timeout" });
  });

  it("UK lookups require an API key (not configured -> unavailable)", async () => {
    const uk = input({ country: "GB", idType: "uk_crn", registrationNumber: "00000006" });
    const outcomes = await queryRegistries(uk, cfg(fetcherReturning(200, {})));
    expect(outcomes[0]).toMatchObject({ status: "unavailable", reason: "not_configured" });
  });
});
