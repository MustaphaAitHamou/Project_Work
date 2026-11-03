"use client";
import { useId, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

/** Free-text tags (skills...). Values are submitted as a JSON array in a hidden input. */
export function TagInput({
  name,
  defaultValue = [],
  max = 30,
  maxLength = 60,
  placeholder,
  inputId,
  onChange,
  ...aria
}: {
  name: string;
  defaultValue?: string[];
  max?: number;
  maxLength?: number;
  placeholder?: string;
  inputId?: string;
  onChange?: (tags: string[]) => void;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const t = useTranslations("forms");
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const listId = useId();
  const update = (next: string[]) => {
    setTags(next);
    onChange?.(next);
  };
  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((p) => p.trim().slice(0, maxLength)).filter(Boolean);
    if (!parts.length) return;
    const lower = new Set(tags.map((x) => x.toLocaleLowerCase()));
    const next = [...tags];
    for (const p of parts) if (!lower.has(p.toLocaleLowerCase()) && next.length < max) next.push(p);
    update(next);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      {tags.length > 0 && (
        <ul id={listId} className="flex flex-wrap gap-1.5" aria-label={t("selected")}>
          {tags.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 ps-2.5 pe-1 text-sm text-primary">
              {tag}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-primary/20"
                aria-label={t("removeTag", { tag })}
                onClick={() => update(tags.filter((x) => x !== tag))}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={inputId}
        value={draft}
        placeholder={tags.length >= max ? t("maxReached", { max }) : placeholder}
        disabled={tags.length >= max}
        maxLength={maxLength * 3}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && draft === "" && tags.length) {
            update(tags.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        {...aria}
      />
      <p className="text-xs text-muted-foreground">{t("tagHint", { count: tags.length, max })}</p>
    </div>
  );
}
