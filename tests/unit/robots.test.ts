import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
  NEXT_PUBLIC_SITE_URL: "https://tamurtjobs.com",
};

async function robotsFor(appEnv: string) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE, APP_ENV: appEnv })) vi.stubEnv(k, v);
  return (await import("@/app/robots")).default();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots.txt", () => {
  it("pre-production and development are never crawled", async () => {
    for (const env of ["preprod", "development"]) {
      const robots = await robotsFor(env);
      expect(robots.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
      expect(robots.sitemap).toBeUndefined();
    }
  });

  it("production: public pages indexable, private spaces and search traps excluded, sitemap declared", async () => {
    const robots = await robotsFor("production");
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    const all = rules.find((r) => r.userAgent === "*")!;
    expect(all.allow).toBe("/");
    expect(all.disallow).toEqual(expect.arrayContaining(["/api/", "/auth/", "/fr/candidate", "/ar/employer", "/es/admin", "/en/login", "/*?*q="]));
    expect(robots.sitemap).toBe("https://tamurtjobs.com/sitemap.xml");
  });

  it("production: Google AdSense's crawler may read the pages that carry ads, search results included", async () => {
    const robots = await robotsFor("production");
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    const adsense = rules.find((r) => r.userAgent === "Mediapartners-Google");
    expect(adsense).toEqual({ userAgent: "Mediapartners-Google", allow: "/", disallow: ["/api/", "/auth/"] });
  });
});
