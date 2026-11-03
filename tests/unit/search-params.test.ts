import { describe, expect, it } from "vitest";
import { alertCriteria, parseSearchParams, toQueryString, toRpcArgs } from "@/lib/search/params";

describe("search parameters", () => {
  it("parses valid values and silently ignores invalid ones", () => {
    const p = parseSearchParams({ q: " react ", country: "fr", contract: "permanent,bogus,fixed_term", posted: "5", radius: "25", page: "0", remoteFrom: "fr" });
    expect(p).toEqual({ q: "react", country: "FR", contract: ["permanent", "fixed_term"], radius: 25, remoteFrom: "FR" });
  });

  it("accepts repeated checkbox values (GET form) as well as CSV", () => {
    const qs = new URLSearchParams("mode=remote&mode=hybrid&level=senior");
    expect(parseSearchParams(qs)).toEqual({ mode: ["remote", "hybrid"], level: ["senior"] });
  });

  it("rejects injection attempts in enumerated fields", () => {
    const p = parseSearchParams({ industry: "it'; drop table jobs;--", company: "../../x", lang: "fr\nx" });
    expect(p).toEqual({});
  });

  it("round-trips through the query string and builds RPC arguments", () => {
    const p = parseSearchParams({ q: "infirmier", country: "CA", remoteFrom: "FR", mode: "remote", page: "3", sort: "date" });
    const again = parseSearchParams(new URLSearchParams(toQueryString(p)));
    expect(again).toEqual(p);
    const args = toRpcArgs(p, "fr");
    expect(args).toMatchObject({ p_q: "infirmier", p_country: "CA", p_remote_from: "FR", p_work_modes: ["remote"], p_offset: 40, p_limit: 20, p_sort: "date" });
  });

  it("uses coordinates instead of the city name for distance searches", () => {
    const p = parseSearchParams({ city: "Lyon", near: "42", radius: "50", sort: "distance" });
    expect(toRpcArgs(p, "fr", { lat: 45.75, lng: 4.85 })).toMatchObject({ p_lat: 45.75, p_lng: 4.85, p_radius_km: 50, p_city: undefined, p_sort: "distance" });
    expect(toRpcArgs(p, "fr", null)).toMatchObject({ p_sort: "relevance" });
  });

  it("keeps only criteria for job alerts", () => {
    expect(alertCriteria({ q: "x", page: 2, sort: "date" })).toEqual({ q: "x" });
  });
});
