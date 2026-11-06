/**
 * Company verification engine. Queries the official registries available for the
 * country, compares the answers with the declared information and decides:
 *   - rejected      : the registry states the company is ceased/dissolved;
 *   - verified      : every strong check passes AND automatic approval is enabled
 *                     for the country by an administrator;
 *   - manual_review : everything else (a human decides, possibly on documents).
 * Being listed in a registry is never sufficient on its own.
 */
import { lookupFrance } from "./providers/fr-recherche-entreprises";
import { lookupUk } from "./providers/uk-companies-house";
import { lookupVies } from "./providers/eu-vies";
import { lookupZefix } from "./providers/ch-zefix";
import { jurisdictionCode, lookupOpenCorporates } from "./providers/opencorporates";
import { emailDomain, isFreeEmail, nameSimilarity, normalizePostalCode, personMatches, registrableDomain, websiteDomain } from "./matching";
import type { Check, Decision, Fetcher, ProviderOutcome, RegistryRecord, VerificationInput, VerificationReport } from "./types";

export interface EngineConfig {
  fetcher: Fetcher;
  timeoutMs: number;
  frEnabled: boolean;
  viesEnabled: boolean;
  companiesHouseKey?: string;
  zefix?: { user?: string; password?: string };
  openCorporatesToken?: string;
}

const unavailable = (provider: string, reason: "not_configured"): ProviderOutcome => ({ status: "unavailable", provider, reason });

export async function queryRegistries(input: VerificationInput, cfg: EngineConfig): Promise<ProviderOutcome[]> {
  const { fetcher, timeoutMs } = cfg;
  const n = input.registrationNumber;
  switch (input.country) {
    case "FR":
      return [cfg.frEnabled ? await lookupFrance(n, fetcher, timeoutMs) : unavailable("fr_recherche_entreprises", "not_configured")];
    case "GB":
      return [await lookupUk(n, cfg.companiesHouseKey, fetcher, timeoutMs)];
    case "BE":
      return [cfg.viesEnabled ? await lookupVies("BE", n, fetcher, timeoutMs) : unavailable("eu_vies", "not_configured")];
    case "ES":
      return [cfg.viesEnabled ? await lookupVies("ES", n, fetcher, timeoutMs) : unavailable("eu_vies", "not_configured")];
    case "LU": {
      const vat = input.secondary.lu_vat?.replace(/^LU/, "");
      if (!vat) return [];
      return [cfg.viesEnabled ? await lookupVies("LU", vat, fetcher, timeoutMs) : unavailable("eu_vies", "not_configured")];
    }
    case "CH":
      return [await lookupZefix(n, cfg.zefix ?? {}, fetcher, timeoutMs)];
    case "US":
    case "CA": {
      const j = jurisdictionCode(input.country, input.registrationRegion, input.idType);
      return j ? [await lookupOpenCorporates(j, n, cfg.openCorporatesToken, fetcher, timeoutMs)] : [];
    }
    default:
      return []; // e.g. Algeria: no public registry API -> manual verification
  }
}

export function buildReport(input: VerificationInput, outcomes: ProviderOutcome[]): VerificationReport {
  const ok = outcomes.filter((o): o is Extract<ProviderOutcome, { status: "ok" }> => o.status === "ok");
  const primary = ok.find((o) => o.record.found) ?? ok[0];
  const record: RegistryRecord | undefined = primary?.record;
  const checks: Check[] = [];
  const flags: string[] = [];

  if (outcomes.length === 0) {
    checks.push({ key: "registry_lookup", result: "unavailable", detail: "no_registry_api" });
    flags.push("no_registry_api");
  } else if (!record) {
    checks.push({ key: "registry_lookup", result: "unavailable", detail: outcomes.map((o) => `${o.provider}:${o.status === "ok" ? "ok" : o.reason}`).join(",") });
    flags.push("registry_unavailable");
  } else {
    checks.push({ key: "registry_lookup", result: record.found ? "pass" : "fail" });
    if (!record.found) flags.push("registry_not_found");
  }

  if (record?.found) {
    checks.push({ key: "registry_active", result: record.active === true ? "pass" : record.active === false ? "fail" : "unavailable" });
    if (record.active === false) flags.push("company_inactive");
    if (record.legalName) {
      const sim = nameSimilarity(input.legalName, record.legalName);
      const result = sim >= 0.75 ? "pass" : sim >= 0.45 ? "warn" : "fail";
      checks.push({ key: "name_match", result, detail: sim.toFixed(2) });
      if (result !== "pass") flags.push("name_mismatch");
    } else checks.push({ key: "name_match", result: "unavailable" });
    if (record.address?.postalCode && input.postalCode) {
      const same = normalizePostalCode(record.address.postalCode) === normalizePostalCode(input.postalCode);
      checks.push({ key: "postal_code_match", result: same ? "pass" : "warn" });
      if (!same) flags.push("address_mismatch");
    } else checks.push({ key: "postal_code_match", result: "unavailable" });
    if (record.officers && record.officers.length > 0) {
      const listed = record.officers.some((o) => personMatches(input.representative.firstName, input.representative.lastName, o.name));
      checks.push({ key: "representative_listed", result: listed ? "pass" : "warn" });
      if (!listed) flags.push("representative_not_listed");
    } else checks.push({ key: "representative_listed", result: "unavailable" });
  } else {
    checks.push({ key: "registry_active", result: "unavailable" }, { key: "name_match", result: "unavailable" }, { key: "postal_code_match", result: "unavailable" }, { key: "representative_listed", result: "unavailable" });
  }

  const free = isFreeEmail(input.representative.email);
  checks.push({ key: "professional_email", result: free ? "warn" : "pass", detail: emailDomain(input.representative.email) });
  if (free) flags.push("free_email");
  const site = websiteDomain(input.website);
  if (site) {
    const match = registrableDomain(emailDomain(input.representative.email)) === site;
    checks.push({ key: "website_domain_match", result: match ? "pass" : "warn" });
    if (!match) flags.push("domain_mismatch");
  } else checks.push({ key: "website_domain_match", result: "unavailable" });
  checks.push({ key: "email_confirmed", result: input.representative.emailConfirmed ? "pass" : "fail" });

  const weights: Record<Check["key"], number> = {
    registry_lookup: 25,
    registry_active: 20,
    name_match: 20,
    representative_listed: 15,
    professional_email: 10,
    website_domain_match: 5,
    postal_code_match: 5,
    email_confirmed: 0,
  };
  const score = Math.round(checks.reduce((s, c) => s + (c.result === "pass" ? weights[c.key] : c.result === "warn" ? weights[c.key] / 2 : 0), 0));

  return {
    provider: primary?.provider ?? outcomes[0]?.provider ?? null,
    registryFound: record ? record.found : null,
    registryActive: record?.found ? record.active : null,
    registryName: record?.legalName ?? null,
    registryData: {
      ...(record?.extract ?? {}),
      officers: record?.officers?.slice(0, 20),
      address: record?.address,
      providers: outcomes.map((o) => ({ provider: o.provider, status: o.status, ...(o.status !== "ok" ? { reason: o.reason } : {}) })),
    },
    checks,
    riskFlags: flags,
    score: Math.min(100, score),
  };
}

export function decide(report: VerificationReport, autoApprovalEnabled: boolean): Decision {
  const c = Object.fromEntries(report.checks.map((x) => [x.key, x.result])) as Record<Check["key"], Check["result"]>;
  if (c.registry_active === "fail") return { outcome: "rejected", messageKey: "inactive" };
  if (c.registry_lookup === "fail") return { outcome: "manual_review", messageKey: "not_found" };
  if (c.registry_lookup === "unavailable") {
    return { outcome: "manual_review", messageKey: report.riskFlags.includes("no_registry_api") ? "needs_documents" : "registry_unavailable" };
  }
  const strong =
    c.registry_lookup === "pass" &&
    c.registry_active === "pass" &&
    c.name_match === "pass" &&
    c.representative_listed === "pass" &&
    c.professional_email === "pass" &&
    c.email_confirmed === "pass" &&
    c.website_domain_match !== "warn" &&
    c.postal_code_match !== "warn";
  if (strong && autoApprovalEnabled) return { outcome: "verified", messageKey: "verified" };
  if (c.representative_listed !== "pass") return { outcome: "manual_review", messageKey: "needs_authority" };
  return { outcome: "manual_review", messageKey: "manual_review" };
}
