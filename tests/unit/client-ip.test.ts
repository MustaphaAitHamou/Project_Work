import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { clientIpFrom } = await import("@/lib/security/request");

// Rate limits and the anti-robot check rely on the visitor's IP: it must come from the
// reverse proxy, never from a header the visitor can write.
describe("client IP behind the hosting proxy", () => {
  it("Vercel (default): first address of x-forwarded-for, then x-real-ip", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), undefined)).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "x-real-ip": "203.0.113.8" }), "")).toBe("203.0.113.8");
    expect(clientIpFrom(new Headers(), undefined)).toBe("0.0.0.0");
  });

  it("own server (Nginx): x-real-ip only, a forged x-forwarded-for is ignored", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.20", "x-real-ip": "198.51.100.20" });
    expect(clientIpFrom(h, "x-real-ip")).toBe("198.51.100.20");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "1.2.3.4" }), "x-real-ip")).toBe("0.0.0.0");
  });

  it("behind Cloudflare: cf-connecting-ip", () => {
    expect(clientIpFrom(new Headers({ "cf-connecting-ip": "192.0.2.44", "x-forwarded-for": "1.2.3.4" }), "cf-connecting-ip")).toBe("192.0.2.44");
  });
});
