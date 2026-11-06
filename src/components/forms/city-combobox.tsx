"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useCountryName } from "@/lib/i18n/names";
import { cn } from "@/lib/utils";

export interface CityOption {
  id: number;
  name: string;
  region_code: string | null;
  region_name: string | null;
  country_code: string;
}

/**
 * Accessible city autocomplete (WAI-ARIA combobox pattern). The typed text is
 * submitted as `textName`; the selected city id as `idName`.
 */
export function CityCombobox({
  idName = "near",
  textName = "city",
  country,
  defaultText = "",
  defaultId,
  onSelect,
  inputId,
  placeholder,
  ...aria
}: {
  idName?: string;
  textName?: string;
  country?: string | null;
  defaultText?: string;
  defaultId?: number | null;
  onSelect?: (city: CityOption | null) => void;
  inputId?: string;
  placeholder?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
}) {
  const t = useTranslations("search");
  const countryName = useCountryName();
  const listId = useId();
  const [text, setText] = useState(defaultText);
  const [selectedId, setSelectedId] = useState<number | null>(defaultId ?? null);
  const [results, setResults] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const abort = useRef<AbortController | null>(null);
  // No suggestions while the query is too short or once a city has been chosen.
  const searchable = text.trim().length >= 2 && !selectedId;
  const items = searchable ? results : [];

  useEffect(() => {
    if (!searchable) return;
    const handle = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const qs = new URLSearchParams({ q: text });
        if (country) qs.set("country", country);
        const res = await fetch(`/api/cities?${qs}`, { signal: abort.current.signal });
        const json = (await res.json()) as { items: CityOption[] };
        setResults(json.items);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted */
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [text, country, searchable]);

  const choose = (c: CityOption) => {
    setText(c.name);
    setSelectedId(c.id);
    setOpen(false);
    onSelect?.(c);
  };

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={inputId}
        name={textName}
        value={text}
        placeholder={placeholder ?? t("cityPlaceholder")}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="ps-9"
        onChange={(e) => {
          setText(e.target.value);
          if (selectedId) {
            setSelectedId(null);
            onSelect?.(null);
          }
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        {...aria}
      />
      <input type="hidden" name={idName} value={selectedId ?? ""} />
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
          {items.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              className={cn("cursor-pointer rounded-md px-3 py-2 text-sm", i === active ? "bg-muted" : "hover:bg-muted")}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · {[c.region_name, countryName(c.country_code)].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
