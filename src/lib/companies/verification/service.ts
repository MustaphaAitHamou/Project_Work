import "server-only";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { errorKey, type ErrorKey } from "@/lib/errors";
import { buildReport, decide, queryRegistries, type EngineConfig } from "./engine";
import type { Decision, VerificationInput } from "./types";

export function engineConfigFromEnv(fetcher: EngineConfig["fetcher"] = fetch): EngineConfig {
  const e = env();
  return {
    fetcher,
    timeoutMs: e.REGISTRY_HTTP_TIMEOUT_MS,
    frEnabled: e.REGISTRY_FR_ENABLED === "true",
    viesEnabled: e.REGISTRY_VIES_ENABLED === "true",
    companiesHouseKey: e.COMPANIES_HOUSE_API_KEY,
    zefix: { user: e.ZEFIX_USERNAME, password: e.ZEFIX_PASSWORD },
    openCorporatesToken: e.OPENCORPORATES_API_TOKEN,
  };
}

interface StartResult {
  company: {
    id: string;
    registration_country: string;
    registration_id_type: string;
    registration_number: string;
    registration_region: string | null;
    secondary_identifiers: Record<string, string>;
    legal_name: string;
    hq_postal_code: string | null;
    website: string | null;
  };
  representative: { first_name: string; last_name: string; email: string; email_confirmed: boolean; is_legal_representative: boolean };
  auto_verification_enabled: boolean;
}

/**
 * Runs the automated verification for a company and records the outcome.
 * Never leaves the company stuck in "auto_check": unexpected failures are
 * recorded as a manual review with the "engine_error" flag.
 */
export async function runCompanyVerification(
  actorId: string,
  companyId: string,
  locale: string,
  cfg: EngineConfig = engineConfigFromEnv(),
): Promise<{ ok: true; decision: Decision } | { ok: false; error: ErrorKey }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verification_start", { p_actor: actorId, p_company_id: companyId });
  if (error) return { ok: false, error: errorKey(error) };
  const start = data as unknown as StartResult;
  const t = await getTranslations({ locale, namespace: "verification.messages" });
  const input: VerificationInput = {
    companyId,
    country: start.company.registration_country,
    idType: start.company.registration_id_type,
    registrationNumber: start.company.registration_number,
    registrationRegion: start.company.registration_region,
    secondary: start.company.secondary_identifiers ?? {},
    legalName: start.company.legal_name,
    postalCode: start.company.hq_postal_code,
    website: start.company.website,
    representative: {
      firstName: start.representative.first_name,
      lastName: start.representative.last_name,
      email: start.representative.email,
      emailConfirmed: start.representative.email_confirmed,
      isLegalRepresentative: start.representative.is_legal_representative,
    },
  };
  let decision: Decision;
  let payload: Record<string, unknown>;
  try {
    const outcomes = await queryRegistries(input, cfg);
    const report = buildReport(input, outcomes);
    decision = decide(report, start.auto_verification_enabled);
    payload = {
      provider: report.provider,
      registry_found: report.registryFound,
      registry_active: report.registryActive,
      registry_name: report.registryName,
      registry_data: report.registryData,
      checks: report.checks,
      risk_flags: report.riskFlags,
      score: report.score,
    };
  } catch (e) {
    console.error("verification engine error", e);
    decision = { outcome: "manual_review", messageKey: "manual_review" };
    payload = { checks: [], risk_flags: ["engine_error"], score: 0 };
  }
  const { error: recordError } = await admin.rpc("verification_record_result", {
    p_company_id: companyId,
    p_outcome: decision.outcome,
    p: { ...payload, decision_reason: decision.messageKey, message: t(decision.messageKey), submitted_by: actorId },
  });
  if (recordError) return { ok: false, error: errorKey(recordError) };
  return { ok: true, decision };
}
