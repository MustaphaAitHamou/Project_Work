"use client";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CONTRACT_TYPES, LANGUAGE_LEVELS, MARKETS, REMOTE_PREFERENCES, WORK_TIMES, WORKING_LANGUAGES } from "@/lib/domain";
import { useCountryName, useLanguageName } from "@/lib/i18n/names";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { TagInput } from "@/components/forms/tag-input";
import { CountryCheckboxes } from "@/components/forms/country-checkboxes";
import { updateProfileAction } from "@/app/[locale]/candidate/actions";

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  email: string;
  headline: string;
  summary: string;
  countryCode: string;
  regionCode: string;
  city: string;
  phone: string;
  skills: string[];
  languages: { code: string; level: string }[];
  desiredContractTypes: string[];
  desiredWorkTime: string[];
  remotePreference: string;
  willingToRelocate: boolean;
  mobilityCountries: string[];
  yearsOfExperience: number | null;
}

export function ProfileForm({ values, regionsByCountry }: { values: ProfileFormValues; regionsByCountry: Record<string, { code: string; name: string }[]> }) {
  const t = useTranslations("candidate.profile");
  const te = useTranslations("enums");
  const locale = useLocale();
  const countryName = useCountryName();
  const languageName = useLanguageName();
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  const [country, setCountry] = useState(values.countryCode);
  const [languages, setLanguages] = useState(values.languages.length ? values.languages : [{ code: locale, level: "c2" }]);
  const fe = state.fieldErrors ?? {};
  const regions = regionsByCountry[country] ?? [];

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="languages" value={JSON.stringify(languages)} />
      <FormMessage state={state} toastOnSuccess />

      <Card>
        <CardHeader>
          <CardTitle>{t("identityTitle")}</CardTitle>
          <CardDescription>{t("identityHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="firstName" label={t("firstName")} required error={fe.firstName}>
            {(p) => <Input {...p} name="firstName" defaultValue={values.firstName} autoComplete="given-name" maxLength={100} />}
          </FormField>
          <FormField id="lastName" label={t("lastName")} required error={fe.lastName}>
            {(p) => <Input {...p} name="lastName" defaultValue={values.lastName} autoComplete="family-name" maxLength={100} />}
          </FormField>
          <FormField id="email" label={t("email")} hint={t("emailHint")}>
            {(p) => <Input {...p} value={values.email} readOnly disabled />}
          </FormField>
          <FormField id="phone" label={t("phone")} hint={t("phoneHint")} error={fe.phone}>
            {(p) => <Input {...p} name="phone" type="tel" defaultValue={values.phone} autoComplete="tel" maxLength={25} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("professionalTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField id="headline" label={t("headline")} hint={t("headlineHint")} required error={fe.headline}>
            {(p) => <Input {...p} name="headline" defaultValue={values.headline} maxLength={150} />}
          </FormField>
          <FormField id="summary" label={t("summary")} hint={t("summaryHint")}>
            {(p) => <Textarea {...p} name="summary" defaultValue={values.summary} maxLength={3000} rows={5} />}
          </FormField>
          <FormField id="skills" label={t("skills")} hint={t("skillsHint")} required error={fe.skills}>
            {(p) => <TagInput inputId={p.id} aria-describedby={p["aria-describedby"]} name="skills" defaultValue={values.skills} max={50} placeholder={t("skillsPlaceholder")} />}
          </FormField>
          <FormField id="yearsOfExperience" label={t("yearsOfExperience")}>
            {(p) => (
              <Input {...p} name="yearsOfExperience" type="number" min={0} max={60} defaultValue={values.yearsOfExperience ?? ""} className="w-32" inputMode="numeric" />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("locationTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField id="countryCode" label={t("country")} required error={fe.countryCode}>
            {(p) => (
              <NativeSelect {...p} name="countryCode" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">{t("choose")}</option>
                {[...MARKETS, "DE", "IT", "PT", "NL", "MA", "TN", "SN", "CI", "CM"].map((c) => (
                  <option key={c} value={c}>
                    {countryName(c)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="regionCode" label={t("region")}>
            {(p) => (
              <NativeSelect {...p} name="regionCode" defaultValue={values.regionCode} disabled={regions.length === 0} key={country}>
                <option value="">{t("choose")}</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="city" label={t("city")} required error={fe.city}>
            {(p) => <Input {...p} name="city" defaultValue={values.city} autoComplete="address-level2" maxLength={120} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("languagesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {languages.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="flex-1 space-y-1 text-sm">
                <span>{t("language")}</span>
                <NativeSelect value={l.code} onChange={(e) => setLanguages(languages.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}>
                  {WORKING_LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {languageName(code)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="flex-1 space-y-1 text-sm">
                <span>{t("level")}</span>
                <NativeSelect value={l.level} onChange={(e) => setLanguages(languages.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)))}>
                  {LANGUAGE_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {te(`languageLevel.${lv}`)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button type="button" variant="ghost" size="icon" aria-label={t("removeLanguage")} onClick={() => setLanguages(languages.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          {languages.length < 15 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setLanguages([...languages, { code: "en", level: "b2" }])}>
              <Plus aria-hidden />
              {t("addLanguage")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("preferencesTitle")}</CardTitle>
          <CardDescription>{t("preferencesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("contractTypes")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONTRACT_TYPES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox name="desiredContractTypes" value={c} defaultChecked={values.desiredContractTypes.includes(c)} />
                  {te(`contractType.${c}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("workTime")}</legend>
            <div className="flex flex-wrap gap-4">
              {WORK_TIMES.map((w) => (
                <label key={w} className="flex items-center gap-2 text-sm">
                  <Checkbox name="desiredWorkTime" value={w} defaultChecked={values.desiredWorkTime.includes(w)} />
                  {te(`workTime.${w}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <FormField id="remotePreference" label={t("remotePreference")}>
            {(p) => (
              <NativeSelect {...p} name="remotePreference" defaultValue={values.remotePreference} className="sm:w-72">
                {REMOTE_PREFERENCES.map((r) => (
                  <option key={r} value={r}>
                    {te(`remotePreference.${r}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="willingToRelocate" defaultChecked={values.willingToRelocate} />
            {t("willingToRelocate")}
          </label>
          <CountryCheckboxes name="mobilityCountries" countries={MARKETS} defaultValue={values.mobilityCountries} legend={t("mobilityCountries")} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton size="lg">{t("save")}</SubmitButton>
      </div>
    </form>
  );
}
