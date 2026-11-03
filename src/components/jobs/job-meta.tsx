import { useLocale, useTranslations } from "next-intl";
import { Briefcase, Clock, Globe2, MapPin, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/format";
import { useCountryName } from "@/lib/i18n/names";
import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];

export function SalaryText({
  min,
  max,
  currency,
  period,
}: {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: E["salary_period"] | null;
}) {
  const t = useTranslations("enums");
  const tj = useTranslations("job");
  const locale = useLocale();
  if (!currency || (min === null && max === null) || !period) return <span>{tj("salaryNotSpecified")}</span>;
  const fmt = (v: number) => formatAmount(v, currency, locale);
  const range = min !== null && max !== null && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt((min ?? max) as number);
  return (
    <span>
      {range} <span className="text-muted-foreground">{t(`salaryPeriod.${period}`)}</span>
    </span>
  );
}

export function LocationText({ city, country, regionName }: { city: string | null; country: string | null; regionName?: string | null }) {
  const countryName = useCountryName();
  return <span>{[city, regionName, country ? countryName(country) : null].filter(Boolean).join(", ")}</span>;
}

export function RemoteScopeText({ mode, scope, countries }: { mode: E["work_mode"]; scope: E["remote_scope"] | null; countries: string[] | null }) {
  const t = useTranslations("enums");
  const countryName = useCountryName();
  if (mode === "onsite" || !scope) return null;
  if (scope === "listed_countries" && countries?.length) {
    return (
      <span>
        {t("remoteScope.listed_countries")} : {countries.map((c) => countryName(c)).join(", ")}
      </span>
    );
  }
  return <span>{t(`remoteScope.${scope}`)}</span>;
}

export function JobBadges({
  contractType,
  workMode,
  workTime,
  experienceLevel,
}: {
  contractType: E["contract_type"];
  workMode: E["work_mode"];
  workTime?: E["work_time"];
  experienceLevel?: E["experience_level"];
}) {
  const t = useTranslations("enums");
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary">
        <Briefcase aria-hidden />
        {t(`contractType.${contractType}`)}
      </Badge>
      <Badge variant={workMode === "remote" ? "default" : "outline"}>
        {workMode === "remote" ? <Globe2 aria-hidden /> : <MapPin aria-hidden />}
        {t(`workMode.${workMode}`)}
      </Badge>
      {workTime && workTime !== "full_time" && (
        <Badge variant="outline">
          <Clock aria-hidden />
          {t(`workTime.${workTime}`)}
        </Badge>
      )}
      {experienceLevel && <Badge variant="muted">{t(`experienceLevel.${experienceLevel}`)}</Badge>}
    </div>
  );
}

export function MetaLine({ icon: Icon, children }: { icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
