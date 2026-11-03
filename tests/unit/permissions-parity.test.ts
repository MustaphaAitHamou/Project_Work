import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

describe("permission matrix", () => {
  it("is identical in TypeScript and in SQL (app.permission_roles)", () => {
    const sql = readFileSync(path.join(__dirname, "../../supabase/migrations/20261103090700_security_helpers.sql"), "utf8");
    const fromSql: Record<string, string[]> = {};
    for (const m of sql.matchAll(/when '([a-z_.]+)' then array\[([^\]]+)\]/g)) {
      fromSql[m[1]] = m[2].split(",").map((s) => s.trim().replace(/'/g, ""));
    }
    expect(Object.keys(fromSql).sort()).toEqual(Object.keys(PERMISSIONS).sort());
    for (const [perm, roles] of Object.entries(PERMISSIONS)) expect(fromSql[perm]?.sort()).toEqual([...roles].sort());
  });

  it("checks roles", () => {
    expect(hasPermission(["moderator"], "jobs.moderate")).toBe(true);
    expect(hasPermission(["moderator"], "countries.manage")).toBe(false);
    expect(hasPermission([], "dashboard.view")).toBe(false);
  });
});
