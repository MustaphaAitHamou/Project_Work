import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cloudflare Turnstile on the authentication forms. The widget's token must reach Supabase Auth
 * (which checks it once "Enable Captcha protection" is on) for sign-up, sign-in, password reset
 * and confirmation resend; it must be sent exactly once and never checked by the application as
 * well (a token is single-use); a refused token must give a message the visitor can act on, and
 * its cause must be logged without personal data.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, string>) => (values ? `${key}[${Object.values(values).join("|")}]` : key),
}));
vi.mock("@/lib/security/request", () => ({ ipKey: async () => "ip-key", safeNextPath: () => null }));
const rateLimit = vi.fn(async () => true);
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...(args as [])) }));
vi.mock("@/lib/security/email-domain", () => ({ checkEmailDomain: async () => "ok" }));
const production = vi.fn(() => false);
vi.mock("@/lib/env", () => ({ isProductionDeployment: () => production(), siteUrl: (p: string) => `https://preprod.example.test${p}` }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => null, spacePath: () => "/fr/candidate" }));

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { account_type: "candidate" } }) }) }) }) }),
}));

const { signUpAction, signInAction, forgotPasswordAction, resendConfirmationAction } = await import("@/app/[locale]/(auth)/actions");
const { captchaFailure, isCaptchaError } = await import("@/lib/auth/captcha");
const initial = { ok: false, message: null } as never;
const refused = (codes: string) => Object.assign(new Error(`captcha protection: request disallowed (${codes})`), { code: "captcha_failed", status: 400 });

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ locale: "fr", captchaToken: "turnstile-token-1", ...fields })) fd.set(k, v);
  return fd;
}
async function run(action: () => Promise<unknown>) {
  try {
    return await action();
  } catch (e) {
    return { redirectedTo: (e as { to?: string }).to };
  }
}
const signIn = (fields: Record<string, string> = {}) => run(() => signInAction(initial, form({ email: "lina@example.test", password: "x", ...fields })));

let fetchSpy: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  production.mockReturnValue(false);
  fetchSpy = vi.spyOn(globalThis, "fetch");
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Supabase's refusal, read from its message (Cloudflare codes)", () => {
  it.each([
    ["captcha protection: request disallowed (no captcha response (captcha_token) found in request)", "missing"],
    ["captcha protection: request disallowed (timeout-or-duplicate)", "expired_or_reused"],
    ["captcha protection: request disallowed (invalid-input-response)", "rejected"],
    ["captcha protection: request disallowed (invalid-input-secret)", "misconfigured"],
    ["captcha protection: request disallowed (internal-error)", "unavailable"],
    ["captcha verification process failed", "unavailable"],
    ["captcha protection: request disallowed", "unknown"],
  ])("%s → %s", (message, reason) => {
    expect(captchaFailure({ code: "captcha_failed", message }).reason).toBe(reason);
  });

  it("the detail lists Cloudflare's codes only, and Supabase being unable to reach Cloudflare counts as a captcha error", () => {
    expect(captchaFailure(refused("invalid-input-response, timeout-or-duplicate")).detail).toBe("invalid-input-response, timeout-or-duplicate");
    expect(isCaptchaError({ code: "unexpected_failure", message: "captcha verification process failed", status: 500 })).toBe(true);
    expect(isCaptchaError({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(false);
  });
});

describe("The token goes to Supabase Auth, once, and only there", () => {
  it("sign-up", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: { id: "u1", identities: [{}] } }, error: null });
    const fd = form({ accountType: "candidate", firstName: "Lina", lastName: "Test", email: "lina@example.test", password: "Motdepasse-Solide-1", passwordConfirm: "Motdepasse-Solide-1", terms: "on" });
    expect(await run(() => signUpAction(initial, fd))).toEqual({ redirectedTo: "/fr/check-email?reason=signup" });
    expect(auth.signUp).toHaveBeenCalledTimes(1);
    expect(auth.signUp.mock.calls[0][0].options.captchaToken).toBe("turnstile-token-1");
  });

  it("sign-in: exactly the widget's token, a single call, and no check by the application itself", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    expect(await signIn()).toEqual({ redirectedTo: "/fr/candidate" });
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(auth.signInWithPassword.mock.calls[0][0].options).toEqual({ captchaToken: "turnstile-token-1" });
    // No call to Cloudflare from the application: Supabase would then get a used token.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("password reset and confirmation resend", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    expect(await forgotPasswordAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: true, message: "resetEmailSent" });
    expect(auth.resetPasswordForEmail.mock.calls[0][1]).toMatchObject({ captchaToken: "turnstile-token-1" });
    auth.resend.mockResolvedValueOnce({ error: null });
    expect(await resendConfirmationAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: true, message: "confirmationResent" });
    expect(auth.resend.mock.calls[0][0]).toMatchObject({ type: "signup", email: "lina@example.test", options: { captchaToken: "turnstile-token-1" } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no widget configured (local development): no token is sent and none is required", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { code: "invalid_credentials", status: 400 } });
    expect(await signIn({ captchaToken: "" })).toMatchObject({ ok: false, message: "invalidCredentials" });
    expect(auth.signInWithPassword.mock.calls[0][0].options).toEqual({ captchaToken: undefined });
  });
});

describe("Widget shown but no token in the form: refused before calling Supabase", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "0x4AAAAAAAtest-site-key"));

  it("sign-in, reset, resend and sign-up: a clear « wait for the check » message, no Supabase call, no attempt counted", async () => {
    expect(await signIn({ captchaToken: "  " })).toMatchObject({ ok: false, message: "captchaMissing" });
    expect(await forgotPasswordAction(initial, form({ email: "lina@example.test", captchaToken: "" }))).toMatchObject({ ok: false, message: "captchaMissing" });
    expect(await resendConfirmationAction(initial, form({ email: "lina@example.test", captchaToken: "" }))).toMatchObject({ ok: false, message: "captchaMissing" });
    const fd = form({ accountType: "candidate", firstName: "Lina", lastName: "Test", email: "lina@example.test", password: "Motdepasse-Solide-1", passwordConfirm: "Motdepasse-Solide-1", terms: "on", captchaToken: "" });
    expect(await run(() => signUpAction(initial, fd))).toMatchObject({ ok: false, message: "captchaMissing" });
    for (const fn of Object.values(auth)) expect(fn).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("with a token, the request goes through normally", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    expect(await signIn()).toEqual({ redirectedTo: "/fr/candidate" });
  });
});

describe("A token refused by Supabase: actionable message, technical detail outside production, cause logged", () => {
  it("expired or already used: the visitor is told the check restarted", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: refused("timeout-or-duplicate") });
    expect(await signIn()).toMatchObject({ ok: false, message: "captchaExpired errors.technicalDetail[timeout-or-duplicate]" });
    expect(warn).toHaveBeenCalledWith("[captcha] signIn: refused by Supabase Auth (expired_or_reused: timeout-or-duplicate)");
  });

  it("token of another widget (secret in Supabase not matching the site key): generic message, Cloudflare code in pre-production", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: refused("invalid-input-response") });
    expect(await signIn()).toMatchObject({ ok: false, message: "captchaFailed errors.technicalDetail[invalid-input-response]" });
  });

  it("invalid secret key in Supabase: logged as an error (configuration problem)", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: refused("invalid-input-secret") });
    expect(await forgotPasswordAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: false, message: "captchaFailed errors.technicalDetail[invalid-input-secret]" });
    expect(error).toHaveBeenCalledWith("[captcha] resetPassword: refused by Supabase Auth (misconfigured: invalid-input-secret)");
  });

  it("Cloudflare unreachable from Supabase: « try again in a moment », not « wrong password »", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { code: "unexpected_failure", message: "captcha verification process failed", status: 500 } });
    expect(await signIn()).toMatchObject({ ok: false, message: expect.stringMatching(/^captchaUnavailable /) });
  });

  it("in production: the same messages, never a technical detail", async () => {
    production.mockReturnValue(true);
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: refused("invalid-input-response") });
    expect(await signIn()).toMatchObject({ ok: false, message: "captchaFailed" });
    auth.resend.mockResolvedValueOnce({ error: refused("timeout-or-duplicate") });
    expect(await resendConfirmationAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: false, message: "captchaExpired" });
  });

  it("sign-up: the reason and, outside production, Cloudflare's code for the form", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null }, error: refused("invalid-input-response") });
    const fd = form({ accountType: "candidate", firstName: "Lina", lastName: "Test", email: "lina@example.test", password: "Motdepasse-Solide-1", passwordConfirm: "Motdepasse-Solide-1", terms: "on" });
    expect(await run(() => signUpAction(initial, fd))).toMatchObject({ ok: false, message: "captchaFailed", data: { reason: "captcha", technical: "invalid-input-response" } });
  });

  it("logs never contain the token, the address or the password", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: refused("timeout-or-duplicate") });
    await signIn({ password: "Secret-Password-9" });
    const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    for (const secret of ["turnstile-token-1", "lina@example.test", "Secret-Password-9"]) expect(logged).not.toContain(secret);
  });
});
