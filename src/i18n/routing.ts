import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "en", "es", "ar"] as const;
export type AppLocale = (typeof locales)[number];
export const rtlLocales: ReadonlyArray<AppLocale> = ["ar"];

export const routing = defineRouting({
  locales,
  defaultLocale: "fr",
  localePrefix: "always",
  localeCookie: {
    // Strictly necessary preference cookie (language), see the cookie policy.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },
});

export function isRtl(locale: string): boolean {
  return (rtlLocales as readonly string[]).includes(locale);
}
