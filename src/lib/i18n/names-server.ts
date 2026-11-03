import "server-only";
import { getTranslations } from "next-intl/server";

export async function getCountryNamer(locale?: string) {
  const t = locale ? await getTranslations({ locale, namespace: "countries" }) : await getTranslations("countries");
  return (code: string | null | undefined): string => {
    if (!code) return "";
    const c = code.toUpperCase();
    return t.has(c as never) ? t(c as never) : c;
  };
}

export async function getLanguageNamer(locale?: string) {
  const t = locale ? await getTranslations({ locale, namespace: "languages" }) : await getTranslations("languages");
  return (code: string | null | undefined): string => {
    if (!code) return "";
    return t.has(code as never) ? t(code as never) : code;
  };
}
