import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

const LOCALES = ["fr", "en", "es", "ar"] as const;
const load = (l: string) => JSON.parse(readFileSync(path.join(__dirname, `../../messages/${l}.json`), "utf8")) as Record<string, unknown>;

function entries(obj: unknown, prefix = ""): [string, string][] {
  if (typeof obj === "string") return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => entries(v, prefix ? `${prefix}.${k}` : k));
}

/**
 * Structural signature of an ICU message: arguments, select keys and rich-text tags.
 * Plural branches may differ between languages (Arabic has zero/two/few/many) but
 * must keep an "other" branch.
 */
function signature(message: string): string[] {
  const out = new Set<string>();
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      switch (el.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          out.add(`arg:${el.value}`);
          break;
        case TYPE.select:
          out.add(`select:${el.value}:${Object.keys(el.options).sort().join("|")}`);
          Object.values(el.options).forEach((o) => walk(o.value));
          break;
        case TYPE.plural:
          out.add(`plural:${el.value}`);
          if (!("other" in el.options)) out.add(`plural-without-other:${el.value}`);
          Object.values(el.options).forEach((o) => walk(o.value));
          break;
        case TYPE.tag:
          out.add(`tag:${el.value}`);
          walk(el.children);
          break;
        default:
          break;
      }
    }
  };
  walk(parse(message));
  return [...out].sort();
}

describe("translations", () => {
  const fr = new Map(entries(load("fr")));

  for (const locale of LOCALES) {
    const messages = new Map(entries(load(locale)));

    it(`${locale}: every message is valid ICU`, () => {
      for (const [key, value] of messages) expect(() => parse(value), `${locale}:${key}`).not.toThrow();
    });

    if (locale === "fr") continue;

    it(`${locale} has exactly the same keys as fr`, () => {
      expect([...messages.keys()].sort()).toEqual([...fr.keys()].sort());
    });

    it(`${locale} keeps the same arguments, select keys and tags`, () => {
      for (const [key, value] of fr) {
        const other = messages.get(key);
        if (other === undefined) continue; // reported by the key test
        expect(signature(other), `${locale}:${key}`).toEqual(signature(value));
      }
    });
  }
});
