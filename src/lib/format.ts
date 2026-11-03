/** Locale-aware formatting helpers (Intl-based, no external data). */
const intlLocale = (locale: string) => (locale === "ar" ? "ar-DZ-u-nu-latn" : locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "fr-FR");

export function formatMoneyMinor(amountMinor: number, currency: string, locale: string, minorUnits = 2): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(amountMinor / 10 ** minorUnits);
}

export function formatAmount(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatDate(value: string | Date | null | undefined, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", ...opts }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, locale: string): string {
  return formatDate(value, locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

const regionNames = new Map<string, Intl.DisplayNames>();
export function countryName(code: string | null | undefined, locale: string): string {
  if (!code) return "";
  let names = regionNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([intlLocale(locale)], { type: "region" });
    regionNames.set(locale, names);
  }
  try {
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

const languageNames = new Map<string, Intl.DisplayNames>();
export function languageName(code: string | null | undefined, locale: string): string {
  if (!code) return "";
  let names = languageNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([intlLocale(locale)], { type: "language" });
    languageNames.set(locale, names);
  }
  try {
    const n = names.of(code) ?? code;
    return n.charAt(0).toLocaleUpperCase(intlLocale(locale)) + n.slice(1);
  } catch {
    return code;
  }
}

export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? "").trim().charAt(0)}${(last ?? "").trim().charAt(0)}`.toUpperCase() || "?";
}

export function jobPath(slug: string, publicId: string): string {
  return `/jobs/${slug}-${publicId}`;
}

/** Extracts the public id from "/jobs/<slug>-<publicId>". */
export function parseJobSlug(param: string): string | null {
  const m = /-([23456789abcdefghjkmnpqrstuvwxyz]{10})$/.exec(param) ?? /^([23456789abcdefghjkmnpqrstuvwxyz]{10})$/.exec(param);
  return m ? m[1] : null;
}
