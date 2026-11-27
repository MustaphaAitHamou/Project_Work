import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server-side Turnstile check of the application's own forms (anonymous reports): Cloudflare's
 * siteverify must confirm the token; a missing, refused or unverifiable token is refused
 * (fail closed). Without a secret key (local development) the check is skipped.
 */
vi.mock("server-only", () => ({}));
const state = { secret: "turnstile-secret" as string | undefined };
vi.mock("@/lib/env", () => ({ env: () => ({ TURNSTILE_SECRET_KEY: state.secret, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" }) }));
vi.mock("@/lib/security/request", () => ({ clientIp: async () => "203.0.113.7" }));

const { verifyTurnstile, captchaEnabled } = await import("@/lib/security/turnstile");
const fetchMock = vi.fn();

beforeEach(() => {
  state.secret = "turnstile-secret";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("verifyTurnstile", () => {
  it("valid token: confirmed by Cloudflare with the secret, the token and the visitor's IP", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstile("token-ok")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({ secret: "turnstile-secret", response: "token-ok", remoteip: "203.0.113.7" });
  });

  it("refused, missing or unverifiable token: refused", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] })));
    expect(await verifyTurnstile("token-used")).toBe(false);
    expect(await verifyTurnstile("")).toBe(false);
    expect(await verifyTurnstile(null)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no call without a token
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await verifyTurnstile("token")).toBe(false);
  });

  it("no secret key (local development): check skipped, captcha reported as not configured", async () => {
    state.secret = undefined;
    expect(await verifyTurnstile(undefined)).toBe(true);
    expect(captchaEnabled()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
