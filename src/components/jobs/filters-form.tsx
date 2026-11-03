"use client";
import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CONTRACT_TYPES, CURRENCIES, EXPERIENCE_LEVELS, MARKETS, WORK_MODES, WORK_TIMES } from "@/lib/domain";
import { POSTED_WITHIN, RADII, type SearchParams } from "@/lib/search/params";
import { useCountryName, useLanguageName } from "@/lib/i18n/names";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2 border-b pb-4 last:border-0">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Filters as a GET form: auto-submits on change with JavaScript, plain submit button without. */
export function FiltersForm({
  params,
  regions,
  industries,
  remoteCountries,
}: {
  params: SearchParams;
  regions: { code: string; name: string }[];
  industries: string[];
  remoteCountries: string[];
}) {
  const t = useTranslations("search");
  const te = useTranslations("enums");
  const ti = useTranslations("industries");
  const locale = useLocale();
  const countryName = useCountryName();
  const languageName = useLanguageName();
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  const checked = (list: string[] | undefined, v: string) => list?.includes(v) ?? false;

  return (
    <form ref={ref} action={`/${locale}/jobs`} method="get" className="space-y-4" onChange={submit} aria-label={t("filters")}>
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.city && <input type="hidden" name="city" value={params.city} />}
      {params.near && <input type="hidden" name="near" value={params.near} />}
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}
      {params.company && <input type="hidden" name="company" value={params.company} />}

      <Fieldset legend={t("location")}>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t("country")}</span>
          <NativeSelect name="country" defaultValue={params.country ?? ""}>
            <option value="">{t("allCountries")}</option>
            {MARKETS.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </NativeSelect>
        </label>
        {params.country && regions.length > 0 && (
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">{t("region")}</span>
            <NativeSelect name="region" defaultValue={params.region ?? ""}>
              <option value="">{t("allRegions")}</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {params.near && (
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">{t("radius")}</span>
            <NativeSelect name="radius" defaultValue={String(params.radius ?? 25)}>
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {t("withinKm", { km: r })}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
      </Fieldset>

      <Fieldset legend={t("remoteWork")}>
        {WORK_MODES.map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <Checkbox name="mode" value={m} defaultChecked={checked(params.mode, m)} />
            {te(`workMode.${m}`)}
          </label>
        ))}
        <label className="block space-y-1 pt-1 text-sm">
          <span className="text-muted-foreground">{t("remoteFrom")}</span>
          <NativeSelect name="remoteFrom" defaultValue={params.remoteFrom ?? ""}>
            <option value="">{t("remoteFromAny")}</option>
            {remoteCountries.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </NativeSelect>
          <span className="block text-xs text-muted-foreground">{t("remoteFromHint")}</span>
        </label>
      </Fieldset>

      <Fieldset legend={t("contract")}>
        {CONTRACT_TYPES.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <Checkbox name="contract" value={c} defaultChecked={checked(params.contract, c)} />
            {te(`contractType.${c}`)}
          </label>
        ))}
        <label className="block space-y-1 pt-1 text-sm">
          <span className="text-muted-foreground">{t("workTime")}</span>
          <NativeSelect name="time" defaultValue={params.time ?? ""}>
            <option value="">{t("any")}</option>
            {WORK_TIMES.map((w) => (
              <option key={w} value={w}>
                {te(`workTime.${w}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </Fieldset>

      <Fieldset legend={t("experience")}>
        {EXPERIENCE_LEVELS.map((l) => (
          <label key={l} className="flex items-center gap-2 text-sm">
            <Checkbox name="level" value={l} defaultChecked={checked(params.level, l)} />
            {te(`experienceLevel.${l}`)}
          </label>
        ))}
      </Fieldset>

      <Fieldset legend={t("salary")}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t("salaryMinAnnual")}</span>
            <Input type="number" name="salaryMin" min={0} step={1000} defaultValue={params.salaryMin ?? ""} inputMode="numeric" onBlur={submit} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t("currency")}</span>
            <NativeSelect name="currency" defaultValue={params.currency ?? ""}>
              <option value="">—</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t("salaryHint")}</p>
      </Fieldset>

      <Fieldset legend={t("more")}>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t("postedWithin")}</span>
          <NativeSelect name="posted" defaultValue={params.posted ? String(params.posted) : ""}>
            <option value="">{t("anyDate")}</option>
            {POSTED_WITHIN.map((d) => (
              <option key={d} value={d}>
                {t("lastDays", { days: d })}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t("industry")}</span>
          <NativeSelect name="industry" defaultValue={params.industry ?? ""}>
            <option value="">{t("allIndustries")}</option>
            {industries.map((i) => (
              <option key={i} value={i}>
                {ti(i as never)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{t("workingLanguage")}</span>
          <NativeSelect name="lang" defaultValue={params.lang ?? ""}>
            <option value="">{t("any")}</option>
            {["fr", "en", "es", "ar", "de", "it", "nl", "pt"].map((l) => (
              <option key={l} value={l}>
                {languageName(l)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </Fieldset>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {t("applyFilters")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/jobs">{t("resetFilters")}</Link>
        </Button>
      </div>
    </form>
  );
}
