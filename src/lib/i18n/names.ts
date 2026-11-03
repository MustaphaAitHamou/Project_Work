/** Shared (server + client) hooks: next-intl useTranslations works in both environments. */
import { useTranslations } from "next-intl";

/** Deterministic country names (from the message catalogue, identical on server and client). */
export function useCountryName() {
  const t = useTranslations("countries");
  return (code: string | null | undefined): string => {
    if (!code) return "";
    const c = code.toUpperCase();
    return t.has(c as never) ? t(c as never) : c;
  };
}

export function useLanguageName() {
  const t = useTranslations("languages");
  return (code: string | null | undefined): string => {
    if (!code) return "";
    return t.has(code as never) ? t(code as never) : code;
  };
}
