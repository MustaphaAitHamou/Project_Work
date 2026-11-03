#!/usr/bin/env node
// Generates deterministic country and language names into messages/<locale>.json
// (namespaces "countries" and "languages") from Node's full ICU data, so that the
// server and the browser always render identical labels (no hydration mismatch).
//   node scripts/generate-display-names.mjs
import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = { fr: "fr-FR", en: "en-GB", es: "es-ES", ar: "ar" };
const LANGUAGES = ["fr", "en", "es", "ar", "de", "it", "nl", "pt", "kab", "ber", "zh", "ru", "tr", "pl", "ro", "wo", "ln", "sw", "ja", "ko", "hi", "uk", "el", "he", "fa"];
const EXCLUDED = new Set(["EU", "EZ", "UN", "ZZ", "QO", "XA", "XB", "AA", "QM", "QN", "QP", "QQ", "QR", "QS", "QT", "QU", "QV", "QW", "QX", "QY", "QZ", "XC", "XD", "XE", "XF", "XG", "XH", "XI", "XJ", "XL", "XM", "XN", "XO", "XP", "XQ", "XR", "XS", "XT", "XU", "XV", "XW", "XX", "XY", "XZ", "ZA0"]);

const en = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
const codes = [];
for (let a = 65; a <= 90; a++)
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    if (EXCLUDED.has(code)) continue;
    const name = en.of(code);
    if (name && name !== code) codes.push(code);
  }

for (const [locale, intl] of Object.entries(LOCALES)) {
  const file = `messages/${locale}.json`;
  const messages = JSON.parse(readFileSync(file, "utf8"));
  const regions = new Intl.DisplayNames([intl], { type: "region" });
  const langs = new Intl.DisplayNames([intl], { type: "language" });
  messages.countries = Object.fromEntries(codes.map((c) => [c, regions.of(c)]));
  const LANGUAGE_OVERRIDES = {
    fr: { ber: "Berbère / tamazight" },
    en: { ber: "Berber / Tamazight" },
    es: { ber: "Bereber / tamazight" },
    ar: { ber: "الأمازيغية" },
  };
  messages.languages = Object.fromEntries(
    LANGUAGES.map((l) => {
      const override = LANGUAGE_OVERRIDES[locale]?.[l];
      if (override) return [l, override];
      const n = langs.of(l) ?? l;
      return [l, n.charAt(0).toLocaleUpperCase(intl) + n.slice(1)];
    }),
  );
  writeFileSync(file, JSON.stringify(messages, null, 1) + "\n");
}
console.log(`countries: ${codes.length}, languages: ${LANGUAGES.length}`);
