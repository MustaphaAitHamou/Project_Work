/**
 * Maps database / API errors to stable translation keys (namespace "errors").
 * Business errors are raised by SQL functions with SQLSTATE P0001 and a stable
 * message; authorisation errors with SQLSTATE 42501.
 */
export const KNOWN_ERROR_KEYS = [
  "forbidden",
  "not_authenticated",
  "account_inactive",
  "not_candidate",
  "profile_incomplete",
  "consent_required",
  "consent_version_mismatch",
  "resume_missing",
  "job_not_open",
  "rate_limited",
  "already_member",
  "country_not_open",
  "company_already_registered",
  "company_locked",
  "verification_not_allowed",
  "verification_not_in_progress",
  "job_not_submittable",
  "job_has_live_subscription",
  "company_not_verified",
  "country_not_enabled",
  "job_incomplete",
  "job_not_closable",
  "job_not_reopenable",
  "reopen_requires_payment",
  "deadline_past",
  "job_not_deletable",
  "invalid_status",
  "job_closed",
  "job_not_payable",
  "no_pricing_plan",
  "quota_exceeded",
  "not_found",
  "reason_required",
  "invalid_transition",
  "invalid_decision",
  "cannot_target_self",
  "last_super_admin",
  "compliance_incomplete",
  "invalid_amount",
  "invalid_scope",
  "duplicate",
  "invalid_input",
  "billing_unavailable",
  "captcha_failed",
  "file_invalid",
  "generic",
] as const;
export type ErrorKey = (typeof KNOWN_ERROR_KEYS)[number];

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

export function errorKey(error: DbErrorLike | null | undefined): ErrorKey {
  if (!error) return "generic";
  const message = error.message ?? "";
  if ((KNOWN_ERROR_KEYS as readonly string[]).includes(message)) return message as ErrorKey;
  switch (error.code) {
    case "42501":
    case "PGRST301":
      return "forbidden";
    case "23505":
      return "duplicate";
    case "23514":
    case "22P02":
    case "22001":
    case "23502":
    case "22023":
      return "invalid_input";
    default:
      return "generic";
  }
}

export class AppError extends Error {
  constructor(
    public readonly key: ErrorKey,
    public readonly detail?: string,
  ) {
    super(key);
  }
}
