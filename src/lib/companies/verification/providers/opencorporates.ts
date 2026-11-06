/**
 * OpenCorporates API v0.4 (aggregates official registers, incl. US states and
 * Canadian jurisdictions). Requires an API token (paid plans; free for some
 * open-data uses).
 *   GET /v0.4/companies/{jurisdiction_code}/{company_number}?api_token=...
 *   -> results.company.{name, current_status, inactive, registered_address, officers[]}
 */
import { getJson, RegistryHttpError } from "../http";
import type { Fetcher, ProviderOutcome, RegistryRecord } from "../types";

export const PROVIDER = "opencorporates";
const BASE = "https://api.opencorporates.com/v0.4/companies";

interface OcCompany {
  name?: string;
  company_number?: string;
  jurisdiction_code?: string;
  current_status?: string | null;
  inactive?: boolean | null;
  registered_address?: { street_address?: string; locality?: string; region?: string; postal_code?: string; country?: string } | null;
  officers?: { officer?: { name?: string; position?: string; inactive?: boolean } }[];
}

/** US state code (e.g. "DE") -> "us_de"; Canadian province "QC" -> "ca_qc"; federal Canada -> "ca". */
export function jurisdictionCode(country: string, region?: string | null, idType?: string): string | null {
  if (country === "US" && region && /^[A-Z]{2}$/.test(region)) return `us_${region.toLowerCase()}`;
  if (country === "CA") {
    if (idType === "ca_corporation") return "ca";
    if (idType === "ca_neq") return "ca_qc";
    if (region && /^[A-Z]{2}$/.test(region)) return `ca_${region.toLowerCase()}`;
  }
  return null;
}

export function parseOpenCorporates(body: { results?: { company?: OcCompany } }): RegistryRecord {
  const c = body.results?.company;
  if (!c) return { found: false, active: null };
  const a = c.registered_address ?? {};
  return {
    found: true,
    active: c.inactive === true ? false : c.inactive === false ? true : null,
    legalName: c.name,
    address: { line: a.street_address, postalCode: a.postal_code, city: a.locality, country: a.country },
    officers: (c.officers ?? []).map((o) => o.officer).filter((o): o is NonNullable<typeof o> => Boolean(o?.name && !o.inactive)).map((o) => ({ name: o.name!, role: o.position })),
    extract: { company_number: c.company_number, jurisdiction_code: c.jurisdiction_code, current_status: c.current_status, inactive: c.inactive },
  };
}

export async function lookupOpenCorporates(jurisdiction: string, number: string, token: string | undefined, fetcher: Fetcher, timeoutMs: number): Promise<ProviderOutcome> {
  if (!token) return { status: "unavailable", provider: PROVIDER, reason: "not_configured" };
  try {
    const body = await getJson<{ results?: { company?: OcCompany } }>(
      fetcher,
      `${BASE}/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(number)}?api_token=${encodeURIComponent(token)}`,
      { timeoutMs },
    );
    return { status: "ok", provider: PROVIDER, record: parseOpenCorporates(body) };
  } catch (e) {
    if (e instanceof RegistryHttpError) {
      if (e.kind === "not_found") return { status: "ok", provider: PROVIDER, record: { found: false, active: null } };
      if (e.kind === "bad_response") return { status: "error", provider: PROVIDER, reason: e.message };
      return { status: "unavailable", provider: PROVIDER, reason: e.kind };
    }
    return { status: "error", provider: PROVIDER, reason: String(e) };
  }
}
