"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CityCombobox } from "@/components/forms/city-combobox";

/** Main search bar (GET form: works without JavaScript, shareable URLs). */
export function SearchBar({
  defaultQ = "",
  defaultCity = "",
  defaultNear,
  hidden = {},
  size = "default",
}: {
  defaultQ?: string;
  defaultCity?: string;
  defaultNear?: number;
  hidden?: Record<string, string | undefined>;
  size?: "default" | "lg";
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [q, setQ] = useState(defaultQ);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggestions?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { items: { suggestion: string }[] };
        setSuggestions([...new Set(json.items.map((i) => i.suggestion))]);
      } catch {
        /* ignore */
      }
    }, 200);
  }, [q]);

  return (
    <form action={`/${locale}/jobs`} method="get" role="search" aria-label={t("searchForm")} className="w-full">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className={size === "lg" ? "grid gap-2 rounded-2xl border bg-card p-2 shadow-lg sm:grid-cols-[1.4fr_1fr_auto]" : "grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]"}>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="search-q" className="sr-only">
            {t("keywordLabel")}
          </label>
          <Input
            id="search-q"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("keywordPlaceholder")}
            list="search-suggestions"
            autoComplete="off"
            maxLength={120}
            className={size === "lg" ? "h-12 border-0 ps-9 shadow-none" : "ps-9"}
          />
          <datalist id="search-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="search-city" className="sr-only">
            {t("locationLabel")}
          </label>
          <CityCombobox inputId="search-city" defaultText={defaultCity} defaultId={defaultNear ?? null} />
        </div>
        <Button type="submit" size={size === "lg" ? "lg" : "default"}>
          <Search aria-hidden />
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
