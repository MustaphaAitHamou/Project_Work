"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SORTS, toQueryString, type SearchParams } from "@/lib/search/params";
import { NativeSelect } from "@/components/ui/native-select";

export function SortSelect({ params, distanceAvailable }: { params: SearchParams; distanceAvailable: boolean }) {
  const t = useTranslations("search");
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("sortBy")}</span>
      <NativeSelect
        className="w-44"
        selectClassName="h-9"
        value={params.sort ?? "relevance"}
        onChange={(e) => {
          const qs = toQueryString(params, { sort: e.target.value as SearchParams["sort"], page: 1 });
          router.push(`/jobs${qs ? `?${qs}` : ""}`);
        }}
      >
        {SORTS.filter((s) => s !== "distance" || distanceAvailable).map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
