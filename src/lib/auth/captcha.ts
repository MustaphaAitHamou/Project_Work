/**
 * Cloudflare Turnstile on the authentication forms. The widget's token goes to Supabase Auth,
 * which checks it ONCE with Cloudflare (a token is single-use and valid 300 seconds): the
 * application never verifies these tokens itself, otherwise Supabase would receive an
 * already-used token ("timeout-or-duplicate"). Only the application's own forms (anonymous
 * report) are verified here, by verifyTurnstile.
 *
 * When Supabase refuses a token it answers `captcha_failed` and relays Cloudflare's error codes
 * in its message, e.g. "captcha protection: request disallowed (invalid-input-response)".
 */
export type CaptchaFailureReason =
  /** No token reached Supabase (form sent before the widget finished). */
  | "missing"
  /** Token expired (300 s) or already used once. */
  | "expired_or_reused"
  /** Token refused: forged, or issued by a widget whose secret is not the one set in Supabase. */
  | "rejected"
  /** The secret key set in Supabase is not a valid Turnstile secret. */
  | "misconfigured"
  /** Cloudflare could not be reached by Supabase. */
  | "unavailable"
  | "unknown";

const CLOUDFLARE_CODES = [
  "missing-input-secret",
  "invalid-input-secret",
  "missing-input-response",
  "invalid-input-response",
  "bad-request",
  "timeout-or-duplicate",
  "internal-error",
] as const;

type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null } | null | undefined;

/** True when Supabase Auth refused the request because of the anti-robot check. */
export function isCaptchaError(error: AuthErrorLike): boolean {
  if (!error) return false;
  return error.code === "captcha_failed" || /captcha verification process failed/i.test(error.message ?? "");
}

/** Why the token was refused, and a short technical detail (Cloudflare codes, never a secret). */
export function captchaFailure(error: AuthErrorLike): { reason: CaptchaFailureReason; detail: string } {
  const message = error?.message ?? "";
  const codes = CLOUDFLARE_CODES.filter((code) => message.includes(code));
  const has = (code: (typeof CLOUDFLARE_CODES)[number]) => codes.includes(code);
  let reason: CaptchaFailureReason = "unknown";
  if (/no captcha response|captcha_token/i.test(message) || has("missing-input-response")) reason = "missing";
  else if (has("timeout-or-duplicate")) reason = "expired_or_reused";
  else if (has("invalid-input-secret") || has("missing-input-secret")) reason = "misconfigured";
  else if (has("invalid-input-response") || has("bad-request")) reason = "rejected";
  else if (has("internal-error") || /verification process failed/i.test(message)) reason = "unavailable";
  const detail = codes.length
    ? codes.join(", ")
    : message
        .replace(/^captcha protection:\s*/i, "")
        .replace(/[^\w\s().,:'-]/g, "")
        .slice(0, 120) || "captcha_failed";
  return { reason, detail };
}

/** Message key (namespace "auth") shown to the visitor for a refused token. */
export function captchaMessageKey(reason: CaptchaFailureReason): "captchaMissing" | "captchaExpired" | "captchaUnavailable" | "captchaFailed" {
  if (reason === "missing") return "captchaMissing";
  if (reason === "expired_or_reused") return "captchaExpired";
  if (reason === "unavailable") return "captchaUnavailable";
  return "captchaFailed";
}

/** The widget is displayed on the forms (public site key built in). */
export function turnstileWidgetEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

/** The token sent by the form, if any. */
export function captchaTokenFrom(formData: FormData): string | undefined {
  const value = formData.get("captchaToken");
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
