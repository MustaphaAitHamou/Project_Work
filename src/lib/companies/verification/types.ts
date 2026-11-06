export interface RegistryOfficer {
  name: string;
  role?: string;
}

export interface RegistryRecord {
  found: boolean;
  /** true = active, false = ceased/dissolved, null = unknown */
  active: boolean | null;
  legalName?: string;
  address?: { line?: string; postalCode?: string; city?: string; country?: string };
  officers?: RegistryOfficer[];
  /** Minimal subset of the registry answer kept for the administrator (no personal data beyond officer names). */
  extract?: Record<string, unknown>;
}

export type ProviderOutcome =
  | { status: "ok"; provider: string; record: RegistryRecord }
  | { status: "unavailable"; provider: string; reason: "not_configured" | "timeout" | "network" | "service_down" | "rate_limited" }
  | { status: "error"; provider: string; reason: string };

export interface VerificationInput {
  companyId: string;
  country: string;
  idType: string;
  registrationNumber: string;
  registrationRegion?: string | null;
  secondary: Record<string, string>;
  legalName: string;
  postalCode?: string | null;
  website?: string | null;
  representative: { firstName: string; lastName: string; email: string; emailConfirmed: boolean; isLegalRepresentative: boolean };
}

export type CheckResult = "pass" | "warn" | "fail" | "unavailable";
export interface Check {
  key:
    | "registry_lookup"
    | "registry_active"
    | "name_match"
    | "postal_code_match"
    | "representative_listed"
    | "professional_email"
    | "website_domain_match"
    | "email_confirmed";
  result: CheckResult;
  detail?: string;
}

export interface VerificationReport {
  provider: string | null;
  registryFound: boolean | null;
  registryActive: boolean | null;
  registryName: string | null;
  registryData: Record<string, unknown>;
  checks: Check[];
  riskFlags: string[];
  score: number;
}

export type Outcome = "verified" | "manual_review" | "rejected";
export interface Decision {
  outcome: Outcome;
  messageKey: "verified" | "inactive" | "not_found" | "needs_documents" | "needs_authority" | "registry_unavailable" | "manual_review";
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
