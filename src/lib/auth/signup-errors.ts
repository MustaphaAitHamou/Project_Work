import { z } from "zod";
import { passwordSchema } from "@/lib/validation/auth";

/**
 * Sign-up validation and error mapping, kept free of server-only imports so that
 * it can be unit-tested. Every result is a message key of the "auth" namespace:
 * the server action translates it, the browser never receives a raw error.
 */

/** Form fields in display order (used to focus the first invalid one). */
export const SIGNUP_FIELDS = ["firstName", "lastName", "email", "password", "passwordConfirm", "terms"] as const;
export type SignupField = (typeof SIGNUP_FIELDS)[number];

export type SignupInput = {
  accountType: unknown;
  firstName: unknown;
  lastName: unknown;
  email: unknown;
  password: unknown;
  passwordConfirm: unknown;
  terms: unknown;
};

export type SignupData = {
  accountType: "candidate" | "employer";
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type SignupValidation =
  | { ok: true; data: SignupData }
  | { ok: false; message: string; fieldErrors: Partial<Record<SignupField, string>> };

const text = (v: unknown) => (typeof v === "string" ? v : "");
const emailSchema = z.email().max(254);

/** Server-side validation of the sign-up form (the browser checks are only a convenience). */
export function validateSignUp(input: SignupInput): SignupValidation {
  const firstName = text(input.firstName).trim();
  const lastName = text(input.lastName).trim();
  const email = text(input.email).trim().toLowerCase();
  const password = text(input.password);
  const passwordConfirm = text(input.passwordConfirm);
  const fieldErrors: Partial<Record<SignupField, string>> = {};
  const missing = new Set<SignupField>();

  if (!firstName) missing.add("firstName");
  else if (firstName.length > 100) fieldErrors.firstName = "validation.firstName";
  if (!lastName) missing.add("lastName");
  else if (lastName.length > 100) fieldErrors.lastName = "validation.lastName";
  if (!email) missing.add("email");
  else if (!emailSchema.safeParse(email).success) fieldErrors.email = "errors.invalidEmail";
  if (!password) missing.add("password");
  else if (!passwordSchema.safeParse(password).success) fieldErrors.password = "errors.weakPassword";
  if (!passwordConfirm) missing.add("passwordConfirm");
  else if (password && passwordConfirm !== password) fieldErrors.passwordConfirm = "validation.confirm";
  if (input.terms !== "on") missing.add("terms");

  for (const field of missing) fieldErrors[field] = field === "terms" ? "validation.terms" : "errors.required";

  const accountType = input.accountType === "employer" || input.accountType === "candidate" ? input.accountType : null;
  const problems = Object.keys(fieldErrors) as SignupField[];
  if (problems.length === 0 && accountType) {
    return { ok: true, data: { accountType, firstName, lastName, email, password } };
  }
  // The account type is a hidden input: an invalid value means a tampered request.
  if (problems.length === 0) return { ok: false, message: "errors.server", fieldErrors };

  let message = "validation.fixErrors";
  if (missing.size > 0) message = "errors.missingFields";
  else if (problems.length === 1) message = fieldErrors[problems[0]]!;
  return { ok: false, message, fieldErrors };
}

/** What the browser is told when Supabase Auth refuses the sign-up. */
export type SignupFailureKind =
  | "email_taken"
  | "weak_password"
  | "pwned_password"
  | "invalid_email"
  | "rate_limited"
  | "captcha"
  | "server";

export type SignupFailure = { kind: SignupFailureKind; code: string };

type AuthErrorLike = { code?: string | null; status?: number | null; name?: string | null; message?: string | null; reasons?: unknown };
type AuthUserLike = { identities?: unknown[] | null } | null | undefined;

const EMAIL_TAKEN = new Set(["user_already_exists", "email_exists", "identity_already_exists"]);
const RATE_LIMITED = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

/**
 * Classifies the result of `supabase.auth.signUp`. Returns null when the account was created.
 * With e-mail confirmations enabled, some Supabase Auth versions answer an existing,
 * confirmed address with a placeholder user that has no identity instead of an error:
 * that case is reported as "email_taken" too.
 */
export function classifySignUpResult(error: AuthErrorLike | null | undefined, user: AuthUserLike): SignupFailure | null {
  if (!error) {
    if (user && Array.isArray(user.identities) && user.identities.length === 0) {
      return { kind: "email_taken", code: "existing_user_placeholder" };
    }
    return null;
  }
  const code = error.code || error.name || "unknown";
  if (error.code && EMAIL_TAKEN.has(error.code)) return { kind: "email_taken", code };
  if (error.code === "weak_password") {
    const reasons = Array.isArray(error.reasons) ? error.reasons : [];
    return { kind: reasons.includes("pwned") ? "pwned_password" : "weak_password", code };
  }
  if (error.code === "email_address_invalid" || (error.code === "validation_failed" && /e-?mail/i.test(error.message ?? ""))) {
    return { kind: "invalid_email", code };
  }
  if ((error.code && RATE_LIMITED.has(error.code)) || error.status === 429) return { kind: "rate_limited", code };
  if (error.code === "captcha_failed") return { kind: "captcha", code };
  // Everything else (Auth unreachable, e-mail delivery not configured, database error…)
  // is a technical problem on our side: never shown in detail to the visitor.
  return { kind: "server", code };
}

/** Message key and field error key for a classified failure. */
export function signupFailureMessages(kind: SignupFailureKind): { message: string; field?: { name: SignupField; message: string } } {
  switch (kind) {
    case "email_taken":
      return { message: "errors.emailTaken", field: { name: "email", message: "errors.emailTakenField" } };
    case "weak_password":
      return { message: "errors.weakPassword", field: { name: "password", message: "errors.weakPassword" } };
    case "pwned_password":
      return { message: "errors.weakPassword", field: { name: "password", message: "errors.pwnedPassword" } };
    case "invalid_email":
      return { message: "errors.invalidEmail", field: { name: "email", message: "errors.invalidEmail" } };
    case "rate_limited":
      return { message: "errors.tooManyAttempts" };
    case "captcha":
      return { message: "captchaFailed" };
    default:
      return { message: "errors.server" };
  }
}

/**
 * True when a Server Action call failed before reaching the server: the browser is
 * offline or the request could not be sent. fetch() reports this with a TypeError
 * ("Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed").
 */
export function isNetworkFailure(error: unknown, online: boolean | undefined): boolean {
  if (online === false) return true;
  return error instanceof TypeError;
}
