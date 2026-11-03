import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const load = (l: string) => JSON.parse(readFileSync(path.join(__dirname, `../../messages/${l}.json`), "utf8")) as Record<string, unknown>;
function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{([a-zA-Z0-9_]+)/g)].map((m) => m[1]).sort();
}

describe("translations", () => {
  const fr = load("fr");
  const frKeys = keys(fr).sort();
  for (const locale of ["en", "es", "ar"]) {
    it(`${locale} has exactly the same keys as fr`, () => {
      expect(keys(load(locale)).sort()).toEqual(frKeys);
    });
    it(`${locale} keeps the same ICU placeholders`, () => {
      const other = load(locale);
      for (const k of frKeys) {
        const get = (o: Record<string, unknown>) => k.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], o) as string;
        const a = placeholders(get(fr));
        const b = placeholders(get(other));
        expect(new Set(b), `${locale}:${k}`).toEqual(new Set(a));
      }
    });
  }
});
