import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// /api/health is public (uptime monitor). In production it must not tell an anonymous visitor
// which services are configured (Stripe mode, e-mail provider, anti-robot…).
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), flush: vi.fn() }));

const state = { production: true, authorized: false };
vi.mock("@/lib/env", () => ({
  isProductionDeployment: () => state.production,
  integrationStatus: () => ({ appEnv: state.production ? "production" : "preprod", stripe: { mode: "live", webhook: true }, captcha: false, problems: [] }),
}));
vi.mock("@/lib/cron/auth", () => ({ isAuthorizedCron: () => state.authorized }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) }),
}));
vi.mock("@/lib/ads/config", () => ({ getAdsConfig: async () => ({ client: null, enabled: false }) }));

const { GET } = await import("@/app/api/health/route");
const call = async () => {
  const res = await GET(new NextRequest("https://jobs.example.test/api/health"));
  return { code: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe("/api/health", () => {
  beforeEach(() => {
    state.production = true;
    state.authorized = false;
  });

  it("production, anonymous: status and database only", async () => {
    const { code, body } = await call();
    expect(code).toBe(200);
    expect(body).toEqual({ status: "ok", database: "ok" });
  });

  it("production, with the scheduled-jobs secret: full configuration", async () => {
    state.authorized = true;
    const { body } = await call();
    expect(body).toMatchObject({ status: "ok", integrations: { appEnv: "production", stripe: { mode: "live" }, ads: { configured: false } } });
  });

  it("pre-production: full configuration without secret (acceptance checks)", async () => {
    state.production = false;
    const { body } = await call();
    expect(body).toMatchObject({ integrations: { appEnv: "preprod", captcha: false } });
  });
});
