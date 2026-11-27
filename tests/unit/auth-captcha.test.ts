import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cloudflare Turnstile on the authentication forms: the token of the widget must reach Supabase
 * Auth (which checks it once "Enable Captcha protection" is on) for sign-up, sign-in, password
 * reset and confirmation resend, and a refused token must give a clear message, never a silent
 * failure.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/lib/security/request", () => ({ ipKey: async () => "ip-key", safeNextPath: () => null }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: async () => true }));
vi.mock("@/lib/security/email-domain", () => ({ checkEmailDomain: async () => "ok" }));
vi.mock("@/lib/env", () => ({ isProductionDeployment: () => false, siteUrl: (p: string) => `https://preprod.example.test${p}` }));
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
const initial = { ok: false, message: null } as never;
const CAPTCHA_FAILED = Object.assign(new Error("captcha protection: request disallowed (timeout-or-duplicate)"), { code: "captcha_failed", status: 400 });

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

beforeEach(() => vi.clearAllMocks());

describe("Turnstile token sent to Supabase Auth", () => {
  it("sign-up", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: { id: "u1", identities: [{}] } }, error: null });
    const fd = form({ accountType: "candidate", firstName: "Lina", lastName: "Test", email: "lina@example.test", password: "Motdepasse-Solide-1", passwordConfirm: "Motdepasse-Solide-1", terms: "on" });
    expect(await run(() => signUpAction(initial, fd))).toEqual({ redirectedTo: "/fr/check-email?reason=signup" });
    expect(auth.signUp.mock.calls[0][0].options.captchaToken).toBe("turnstile-token-1");
  });

  it("sign-in, and a refused token gives the anti-robot message", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: CAPTCHA_FAILED });
    const result = await run(() => signInAction(initial, form({ email: "lina@example.test", password: "x" })));
    expect(auth.signInWithPassword.mock.calls[0][0].options).toEqual({ captchaToken: "turnstile-token-1" });
    expect(result).toMatchObject({ ok: false, message: "captchaFailed" });
  });

  it("password reset: token sent; a refused token is reported instead of « e-mail sent »", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    expect(await forgotPasswordAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: true, message: "resetEmailSent" });
    expect(auth.resetPasswordForEmail.mock.calls[0][1]).toMatchObject({ captchaToken: "turnstile-token-1" });

    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: CAPTCHA_FAILED });
    expect(await forgotPasswordAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: false, message: "captchaFailed" });
    // Any other answer stays generic: it must not reveal whether an account exists.
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: Object.assign(new Error("user not found"), { code: "user_not_found", status: 400 }) });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await forgotPasswordAction(initial, form({ email: "nobody@example.test" }))).toMatchObject({ ok: true, message: "resetEmailSent" });
  });

  it("confirmation e-mail resend: token sent; a refused token is reported", async () => {
    auth.resend.mockResolvedValueOnce({ error: null });
    expect(await resendConfirmationAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: true, message: "confirmationResent" });
    expect(auth.resend.mock.calls[0][0]).toMatchObject({ type: "signup", email: "lina@example.test", options: { captchaToken: "turnstile-token-1" } });

    auth.resend.mockResolvedValueOnce({ error: CAPTCHA_FAILED });
    expect(await resendConfirmationAction(initial, form({ email: "lina@example.test" }))).toMatchObject({ ok: false, message: "captchaFailed" });
  });

  it("no widget configured (local development): no token is sent", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { code: "invalid_credentials", status: 400 } });
    await run(() => signInAction(initial, form({ email: "lina@example.test", password: "x", captchaToken: "" })));
    expect(auth.signInWithPassword.mock.calls[0][0].options).toEqual({ captchaToken: undefined });
  });
});
