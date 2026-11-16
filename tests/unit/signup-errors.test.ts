import { describe, expect, it } from "vitest";
import { classifySignUpResult, isNetworkFailure, signupFailureMessages, validateSignUp } from "@/lib/auth/signup-errors";

const valid = {
  accountType: "candidate",
  firstName: "Amina",
  lastName: "Haddad",
  email: "Amina.Haddad@Example.com ",
  password: "Tamurt-2026x",
  passwordConfirm: "Tamurt-2026x",
  terms: "on",
};

describe("validateSignUp", () => {
  it("accepts a complete form and normalises the e-mail", () => {
    const r = validateSignUp(valid);
    expect(r).toEqual({
      ok: true,
      data: { accountType: "candidate", firstName: "Amina", lastName: "Haddad", email: "amina.haddad@example.com", password: "Tamurt-2026x" },
    });
  });

  it("reports missing fields with one global message and a message under each empty field", () => {
    const r = validateSignUp({ ...valid, firstName: "   ", email: "", terms: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toBe("errors.missingFields");
    expect(r.fieldErrors).toEqual({ firstName: "errors.required", email: "errors.required", terms: "validation.terms" });
  });

  it("explains an invalid e-mail address", () => {
    const r = validateSignUp({ ...valid, email: "amina@" });
    expect(r).toEqual({ ok: false, message: "errors.invalidEmail", fieldErrors: { email: "errors.invalidEmail" } });
  });

  it("explains a password that does not meet the policy", () => {
    for (const password of ["short1A", "alllowercase123", "ALLUPPERCASE123", "NoDigitsHere!"]) {
      const r = validateSignUp({ ...valid, password, passwordConfirm: password });
      expect(r).toEqual({ ok: false, message: "errors.weakPassword", fieldErrors: { password: "errors.weakPassword" } });
    }
  });

  it("detects a confirmation that does not match", () => {
    const r = validateSignUp({ ...valid, passwordConfirm: "Tamurt-2026y" });
    expect(r).toEqual({ ok: false, message: "validation.confirm", fieldErrors: { passwordConfirm: "validation.confirm" } });
  });

  it("uses a generic summary when several different fields are wrong", () => {
    const r = validateSignUp({ ...valid, email: "nope", password: "weak", passwordConfirm: "weak" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toBe("validation.fixErrors");
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["email", "password"]);
  });

  it("refuses a tampered account type without blaming a visible field", () => {
    expect(validateSignUp({ ...valid, accountType: "admin" })).toEqual({ ok: false, message: "errors.server", fieldErrors: {} });
  });

  it("ignores non-text values (FormData files, null)", () => {
    const r = validateSignUp({ ...valid, firstName: null, lastName: { length: 3 } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.firstName).toBe("errors.required");
    expect(r.fieldErrors.lastName).toBe("errors.required");
  });
});

describe("classifySignUpResult", () => {
  it("returns null for a created account", () => {
    expect(classifySignUpResult(null, { identities: [{ id: "x" }] })).toBeNull();
    expect(classifySignUpResult(undefined, undefined)).toBeNull();
  });

  // Codes observed against the local Supabase Auth server (see docs/STATUS.md).
  it.each([
    [{ code: "user_already_exists", status: 422 }, "email_taken"],
    [{ code: "email_exists", status: 422 }, "email_taken"],
    [{ code: "weak_password", status: 422, reasons: ["length", "characters"] }, "weak_password"],
    [{ code: "weak_password", status: 422, reasons: ["pwned"] }, "pwned_password"],
    [{ code: "validation_failed", status: 400, message: "Unable to validate email address: invalid format" }, "invalid_email"],
    [{ code: "email_address_invalid", status: 400 }, "invalid_email"],
    [{ code: "over_email_send_rate_limit", status: 429 }, "rate_limited"],
    [{ code: "over_request_rate_limit", status: 429 }, "rate_limited"],
    [{ status: 429 }, "rate_limited"],
    [{ code: "captcha_failed", status: 400 }, "captcha"],
    [{ name: "AuthRetryableFetchError", status: 0, message: "fetch failed" }, "server"],
    [{ code: "email_address_not_authorized", status: 400 }, "server"],
    [{ code: "unexpected_failure", status: 500 }, "server"],
    [{ code: "validation_failed", status: 400, message: "Signup requires a valid password" }, "server"],
  ])("maps %o to %s", (error, kind) => {
    expect(classifySignUpResult(error, null)?.kind).toBe(kind);
  });

  it("treats the placeholder user returned for an existing address as an existing account", () => {
    expect(classifySignUpResult(null, { identities: [] })).toEqual({ kind: "email_taken", code: "existing_user_placeholder" });
  });

  it("keeps the error code for the technical detail", () => {
    expect(classifySignUpResult({ name: "AuthRetryableFetchError", status: 0 }, null)?.code).toBe("AuthRetryableFetchError");
    expect(classifySignUpResult({ code: "unexpected_failure" }, null)?.code).toBe("unexpected_failure");
  });
});

describe("signupFailureMessages", () => {
  it("points the existing-account message at the e-mail field", () => {
    expect(signupFailureMessages("email_taken")).toEqual({
      message: "errors.emailTaken",
      field: { name: "email", message: "errors.emailTakenField" },
    });
  });

  it("never exposes details for technical errors", () => {
    expect(signupFailureMessages("server")).toEqual({ message: "errors.server" });
    expect(signupFailureMessages("rate_limited")).toEqual({ message: "errors.tooManyAttempts" });
  });
});

describe("isNetworkFailure", () => {
  it("recognises fetch failures and offline browsers", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isNetworkFailure(new Error("boom"), false)).toBe(true);
    expect(isNetworkFailure(new Error("An unexpected response was received from the server."), true)).toBe(false);
  });
});
