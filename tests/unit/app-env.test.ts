import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
};

async function load(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE, APP_ENV: undefined, VERCEL_ENV: undefined, PREPROD_BASIC_AUTH: undefined, ...vars })) {
    if (v === undefined) vi.stubEnv(k, undefined as unknown as string);
    else vi.stubEnv(k, v);
  }
  return import("@/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appEnv", () => {
  it("is development without any deployment variable", async () => {
    const m = await load({});
    expect(m.appEnv()).toBe("development");
    expect(m.isProductionDeployment()).toBe(false);
  });

  it("follows Vercel when APP_ENV is not set", async () => {
    expect((await load({ VERCEL_ENV: "production" })).appEnv()).toBe("production");
    expect((await load({ VERCEL_ENV: "preview" })).appEnv()).toBe("preprod");
  });

  it("lets APP_ENV=preprod win over a Vercel production deployment", async () => {
    const m = await load({ VERCEL_ENV: "production", APP_ENV: "preprod" });
    expect(m.appEnv()).toBe("preprod");
    expect(m.isProductionDeployment()).toBe(false);
  });

  it("reports the pre-production password as a problem in production", async () => {
    const m = await load({ APP_ENV: "production", PREPROD_BASIC_AUTH: "recette:secret" });
    expect(m.integrationStatus().problems).toContain("preprod_basic_auth_in_production");
  });
});
