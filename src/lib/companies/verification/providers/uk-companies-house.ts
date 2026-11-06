/**
 * United Kingdom — Companies House Public Data API (free, API key required, HTTP
 * Basic auth with the key as user name). Documented resources:
 *   GET /company/{company_number}            -> company_name, company_status, registered_office_address
 *   GET /company/{company_number}/officers   -> items[].{name, officer_role, resigned_on}
 */
import { getJson, RegistryHttpError } from "../http";
import type { Fetcher, ProviderOutcome, RegistryRecord } from "../types";

export const PROVIDER = "uk_companies_house";
const BASE = "https://api.company-information.service.gov.uk";

interface CompanyProfile {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  type?: string;
  date_of_creation?: string;
  registered_office_address?: { address_line_1?: string; address_line_2?: string; locality?: string; postal_code?: string; country?: string };
}
interface OfficersList {
  items?: { name?: string; officer_role?: string; resigned_on?: string | null }[];
}

/** "SURNAME, Forename Middle" -> "Forename Middle SURNAME" */
export function ukOfficerName(name: string): string {
  const [last, first] = name.split(",").map((s) => s.trim());
  return first ? `${first} ${last}` : name;
}

export function parseCompaniesHouse(profile: CompanyProfile, officers: OfficersList | null): RegistryRecord {
  const status = profile.company_status?.toLowerCase();
  const a = profile.registered_office_address ?? {};
  return {
    found: true,
    active: status === "active" ? true : status ? false : null,
    legalName: profile.company_name,
    address: { line: [a.address_line_1, a.address_line_2].filter(Boolean).join(", "), postalCode: a.postal_code, city: a.locality, country: "GB" },
    officers: (officers?.items ?? []).filter((o) => !o.resigned_on && o.name).map((o) => ({ name: ukOfficerName(o.name!), role: o.officer_role })),
    extract: { company_number: profile.company_number, company_status: profile.company_status, type: profile.type, date_of_creation: profile.date_of_creation, postal_code: a.postal_code },
  };
}

export async function lookupUk(number: string, apiKey: string | undefined, fetcher: Fetcher, timeoutMs: number): Promise<ProviderOutcome> {
  if (!apiKey) return { status: "unavailable", provider: PROVIDER, reason: "not_configured" };
  const headers = { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` };
  try {
    const profile = await getJson<CompanyProfile>(fetcher, `${BASE}/company/${encodeURIComponent(number)}`, { timeoutMs, headers });
    let officers: OfficersList | null = null;
    try {
      officers = await getJson<OfficersList>(fetcher, `${BASE}/company/${encodeURIComponent(number)}/officers?items_per_page=100`, { timeoutMs, headers });
    } catch {
      officers = null;
    }
    return { status: "ok", provider: PROVIDER, record: parseCompaniesHouse(profile, officers) };
  } catch (e) {
    if (e instanceof RegistryHttpError) {
      if (e.kind === "not_found") return { status: "ok", provider: PROVIDER, record: { found: false, active: null } };
      if (e.kind === "bad_response") return { status: "error", provider: PROVIDER, reason: e.message };
      return { status: "unavailable", provider: PROVIDER, reason: e.kind };
    }
    return { status: "error", provider: PROVIDER, reason: String(e) };
  }
}
