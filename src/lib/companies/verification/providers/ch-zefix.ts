/**
 * Switzerland — Zefix PublicREST (Federal Commercial Registry index). Credentials
 * are issued free of charge on request (HTTP Basic auth).
 *   GET /ZefixPublicREST/api/v1/company/uid/{CHE123456789} -> [{ name, uid, status, legalSeat, ... }]
 * status: ACTIVE | CANCELLED | BEING_CANCELLED.
 */
import { getJson, RegistryHttpError } from "../http";
import type { Fetcher, ProviderOutcome, RegistryRecord } from "../types";

export const PROVIDER = "ch_zefix";
const BASE = "https://www.zefix.admin.ch/ZefixPublicREST/api/v1";

interface ZefixCompany {
  name?: string;
  uid?: string;
  status?: string;
  legalSeat?: string;
  address?: { street?: string; houseNumber?: string; swissZipCode?: string; town?: string };
}

export function parseZefix(body: ZefixCompany[] | ZefixCompany): RegistryRecord {
  const c = Array.isArray(body) ? body[0] : body;
  if (!c) return { found: false, active: null };
  const status = c.status?.toUpperCase();
  return {
    found: true,
    active: status === "ACTIVE" ? true : status ? false : null,
    legalName: c.name,
    address: c.address ? { line: [c.address.street, c.address.houseNumber].filter(Boolean).join(" "), postalCode: c.address.swissZipCode, city: c.address.town, country: "CH" } : { city: c.legalSeat, country: "CH" },
    extract: { uid: c.uid, status: c.status, legal_seat: c.legalSeat },
  };
}

export async function lookupZefix(uid: string, creds: { user?: string; password?: string }, fetcher: Fetcher, timeoutMs: number): Promise<ProviderOutcome> {
  if (!creds.user || !creds.password) return { status: "unavailable", provider: PROVIDER, reason: "not_configured" };
  try {
    const body = await getJson<ZefixCompany[]>(fetcher, `${BASE}/company/uid/${encodeURIComponent(uid)}`, {
      timeoutMs,
      headers: { Authorization: `Basic ${Buffer.from(`${creds.user}:${creds.password}`).toString("base64")}` },
    });
    return { status: "ok", provider: PROVIDER, record: parseZefix(body) };
  } catch (e) {
    if (e instanceof RegistryHttpError) {
      if (e.kind === "not_found") return { status: "ok", provider: PROVIDER, record: { found: false, active: null } };
      if (e.kind === "bad_response") return { status: "error", provider: PROVIDER, reason: e.message };
      return { status: "unavailable", provider: PROVIDER, reason: e.kind };
    }
    return { status: "error", provider: PROVIDER, reason: String(e) };
  }
}
