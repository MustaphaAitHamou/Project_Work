/**
 * European Union — VIES VAT number validation (European Commission REST API,
 * free, no key): GET /taxation_customs/vies/rest-api/ms/{CC}/vat/{number}
 * -> { isValid, name, address, userError }. A valid VAT registration shows that
 * the entity exists and is registered for VAT; some member states (e.g. ES) do not
 * return the name.
 */
import { getJson, RegistryHttpError } from "../http";
import type { Fetcher, ProviderOutcome, RegistryRecord } from "../types";

export const PROVIDER = "eu_vies";
const BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";

interface ViesResponse {
  isValid?: boolean;
  name?: string;
  address?: string;
  userError?: string;
  requestDate?: string;
}

export function parseVies(body: ViesResponse): RegistryRecord | "unavailable" {
  if (body.userError && !["VALID", "INVALID"].includes(body.userError)) return "unavailable";
  const name = body.name && body.name.trim() !== "---" ? body.name.trim() : undefined;
  const address = body.address && body.address.trim() !== "---" ? body.address.replace(/\n/g, ", ").trim() : undefined;
  const postal = address?.match(/\b(\d{4,5})\b/)?.[1];
  return {
    found: body.isValid === true,
    active: body.isValid === true ? true : null,
    legalName: name,
    address: address ? { line: address, postalCode: postal } : undefined,
    extract: { vat_valid: body.isValid, name_returned: Boolean(name), request_date: body.requestDate },
  };
}

export async function lookupVies(countryCode: string, vatNumber: string, fetcher: Fetcher, timeoutMs: number): Promise<ProviderOutcome> {
  try {
    const body = await getJson<ViesResponse>(fetcher, `${BASE}/${countryCode}/vat/${encodeURIComponent(vatNumber)}`, { timeoutMs });
    const parsed = parseVies(body);
    if (parsed === "unavailable") return { status: "unavailable", provider: PROVIDER, reason: "service_down" };
    return { status: "ok", provider: PROVIDER, record: parsed };
  } catch (e) {
    if (e instanceof RegistryHttpError) {
      if (e.kind === "bad_response" || e.kind === "not_found") return { status: "error", provider: PROVIDER, reason: e.message };
      return { status: "unavailable", provider: PROVIDER, reason: e.kind };
    }
    return { status: "error", provider: PROVIDER, reason: String(e) };
  }
}
