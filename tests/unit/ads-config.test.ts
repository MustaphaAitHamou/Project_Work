import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { adsenseClient, parseSlots } = await import("@/lib/ads/config");

describe("AdSense configuration", () => {
  it("accepts only a well-formed publisher id", () => {
    expect(adsenseClient("ca-pub-1234567890123456")).toBe("ca-pub-1234567890123456");
    expect(adsenseClient(" ca-pub-1234567890123456 ")).toBe("ca-pub-1234567890123456");
    expect(adsenseClient("pub-1234567890123456")).toBeNull();
    expect(adsenseClient("ca-pub-12AB")).toBeNull();
    expect(adsenseClient("")).toBeNull();
    expect(adsenseClient(undefined)).toBeNull();
  });

  it("keeps only known placements with numeric ad unit ids", () => {
    expect(parseSlots({ home: "1234567890", job: " 2345678901 ", candidate: "3456789012", jobs: "x<script>", companies: 12 })).toEqual({
      home: "1234567890",
      job: "2345678901",
    });
    expect(parseSlots(null)).toEqual({});
    expect(parseSlots(["1234567890"])).toEqual({});
  });
});
