"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState, useState } from "react";
import { AlertTriangle, Save, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CONTRACT_TYPES,
  CURRENCIES,
  EXPERIENCE_LEVELS,
  MARKETS,
  REMOTE_SCOPES,
  SALARY_PERIODS,
  WORK_AUTHORIZATIONS,
  WORK_MODES,
  WORK_TIMES,
  WORKING_LANGUAGES,
} from "@/lib/domain";
import { initialActionState } from "@/lib/action-state";
import { useCountryName, useLanguageName } from "@/lib/i18n/names";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { TagInput } from "@/components/forms/tag-input";
import { CityCombobox } from "@/components/forms/city-combobox";
import { saveJobAction } from "@/app/[locale]/employer/actions";

export interface JobFormValues {
  jobId?: string;
  title: string;
  description: string;
  missions: string;
  profileSought: string;
  requiredSkills: string[];
  optionalSkills: string[];
  contractType: string;
  workTime: string;
  workMode: string;
  remoteScope: string;
  remoteCountries: string[];
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: string;
  benefits: string;
  experienceLevel: string;
  industry: string;
  workingLanguages: string[];
  workAuthorization: string;
  eligibilityNotes: string;
  startDate: string;
  applicationDeadline: string;
  positionsCount: string;
  countryCode: string;
  regionCode: string;
  city: string;
  cityId: number | null;
  postalCode: string;
  addressLine: string;
}

const EXTRA_REMOTE = ["DE", "IT", "PT", "NL", "IE", "AT", "SE", "DK", "MA", "TN", "SN", "CI"];

export function JobForm({
  values,
  regionsByCountry,
  industries,
  publishableCountries,
  editable,
  flags,
}: {
  values: JobFormValues;
  regionsByCountry: Record<string, { code: string; name: string }[]>;
  industries: string[];
  publishableCountries: string[];
  editable: boolean;
  flags: string[];
}) {
  const t = useTranslations("employer.jobForm");
  const te = useTranslations("enums");
  const ti = useTranslations("industries");
  const locale = useLocale();
  const countryName = useCountryName();
  const languageName = useLanguageName();
  const [state, action] = useActionState(saveJobAction, initialActionState);
  const [country, setCountry] = useState(values.countryCode || "FR");
  const [workMode, setWorkMode] = useState(values.workMode || "onsite");
  const [remoteScope, setRemoteScope] = useState(values.remoteScope || "employer_country");
  const fe = state.fieldErrors ?? {};
  const regions = regionsByCountry[country] ?? [];

  return (
    <ActionForm action={action} className="space-y-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {values.jobId && <input type="hidden" name="jobId" value={values.jobId} />}
      <FormMessage state={state} toastOnSuccess />
      {flags.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>{t("flagsTitle")}</AlertTitle>
          <AlertDescription>
            <p>{t("flagsText")}</p>
            <ul className="mt-1 list-disc ps-5">
              {flags.map((f) => (
                <li key={f}>{t(`flags.${f}` as never)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <fieldset disabled={!editable} className="space-y-6 disabled:opacity-70">
        <Card>
          <CardHeader>
            <CardTitle>{t("sectionPost")}</CardTitle>
            <CardDescription>{t("sectionPostHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField id="title" label={t("title")} required error={fe.title}>
              {(p) => <Input {...p} name="title" defaultValue={values.title} maxLength={150} />}
            </FormField>
            <FormField id="description" label={t("description")} hint={t("descriptionHint")} required error={fe.description}>
              {(p) => <Textarea {...p} name="description" defaultValue={values.description} rows={8} maxLength={15000} />}
            </FormField>
            <FormField id="missions" label={t("missions")} hint={t("listHint")}>
              {(p) => <Textarea {...p} name="missions" defaultValue={values.missions} rows={5} maxLength={8000} />}
            </FormField>
            <FormField id="profileSought" label={t("profileSought")} hint={t("listHint")}>
              {(p) => <Textarea {...p} name="profileSought" defaultValue={values.profileSought} rows={5} maxLength={8000} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="requiredSkills" label={t("requiredSkills")} error={fe.requiredSkills}>
                {(p) => <TagInput inputId={p.id} name="requiredSkills" defaultValue={values.requiredSkills} max={30} />}
              </FormField>
              <FormField id="optionalSkills" label={t("optionalSkills")}>
                {(p) => <TagInput inputId={p.id} name="optionalSkills" defaultValue={values.optionalSkills} max={30} />}
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionContract")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField id="contractType" label={t("contractType")} required>
              {(p) => (
                <NativeSelect {...p} name="contractType" defaultValue={values.contractType || "permanent"}>
                  {CONTRACT_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {te(`contractType.${c}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="workTime" label={t("workTime")} required>
              {(p) => (
                <NativeSelect {...p} name="workTime" defaultValue={values.workTime || "full_time"}>
                  {WORK_TIMES.map((w) => (
                    <option key={w} value={w}>
                      {te(`workTime.${w}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="experienceLevel" label={t("experienceLevel")} required>
              {(p) => (
                <NativeSelect {...p} name="experienceLevel" defaultValue={values.experienceLevel || "mid"}>
                  {EXPERIENCE_LEVELS.map((x) => (
                    <option key={x} value={x}>
                      {te(`experienceLevel.${x}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="industry" label={t("industry")}>
              {(p) => (
                <NativeSelect {...p} name="industry" defaultValue={values.industry}>
                  <option value="">{t("companyIndustry")}</option>
                  {industries.map((i) => (
                    <option key={i} value={i}>
                      {ti(i as never)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="startDate" label={t("startDate")}>
              {(p) => <Input {...p} name="startDate" type="date" defaultValue={values.startDate} />}
            </FormField>
            <FormField id="applicationDeadline" label={t("deadline")} hint={t("deadlineHint")} error={fe.applicationDeadline}>
              {(p) => <Input {...p} name="applicationDeadline" type="date" defaultValue={values.applicationDeadline} />}
            </FormField>
            <FormField id="positionsCount" label={t("positions")}>
              {(p) => <Input {...p} name="positionsCount" type="number" min={1} max={999} defaultValue={values.positionsCount} inputMode="numeric" />}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionLocation")}</CardTitle>
            <CardDescription>{t("sectionLocationHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField id="countryCode" label={t("country")} required error={fe.countryCode}>
              {(p) => (
                <NativeSelect {...p} name="countryCode" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {MARKETS.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c)}
                      {publishableCountries.includes(c) ? "" : ` — ${t("notOpenYet")}`}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="regionCode" label={t("region")}>
              {(p) => (
                <NativeSelect {...p} name="regionCode" defaultValue={values.regionCode} key={country}>
                  <option value="">{t("choose")}</option>
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="job-city" label={t("city")} required error={fe.city}>
              {(p) => (
                <CityCombobox key={country} inputId={p.id} textName="city" idName="cityId" country={country} defaultText={values.city} defaultId={values.cityId} aria-describedby={p["aria-describedby"]} />
              )}
            </FormField>
            <FormField id="postalCode" label={t("postalCode")}>
              {(p) => <Input {...p} name="postalCode" defaultValue={values.postalCode} maxLength={20} />}
            </FormField>
            <FormField id="addressLine" label={t("address")} hint={t("addressHint")} className="sm:col-span-2">
              {(p) => <Input {...p} name="addressLine" defaultValue={values.addressLine} maxLength={200} />}
            </FormField>
            <FormField id="workMode" label={t("workMode")} required>
              {(p) => (
                <NativeSelect {...p} name="workMode" value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
                  {WORK_MODES.map((m) => (
                    <option key={m} value={m}>
                      {te(`workMode.${m}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            {workMode !== "onsite" && (
              <FormField id="remoteScope" label={t("remoteScope")} required error={fe.remoteScope} className="sm:col-span-2">
                {(p) => (
                  <NativeSelect {...p} name="remoteScope" value={remoteScope} onChange={(e) => setRemoteScope(e.target.value)}>
                    {REMOTE_SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {te(`remoteScope.${s}`)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
            {workMode !== "onsite" && remoteScope === "listed_countries" && (
              <fieldset className="sm:col-span-3">
                <legend className="mb-2 text-sm font-medium">{t("remoteCountries")}</legend>
                {fe.remoteCountries && <p className="mb-2 text-xs font-medium text-destructive">{fe.remoteCountries}</p>}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[...MARKETS, ...EXTRA_REMOTE].map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <Checkbox name="remoteCountries" value={c} defaultChecked={values.remoteCountries.includes(c) || (values.remoteCountries.length === 0 && c === country)} />
                      {countryName(c)}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {workMode !== "onsite" && remoteScope === "worldwide" && <p className="text-xs text-muted-foreground sm:col-span-3">{t("worldwideHint")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionSalary")}</CardTitle>
            <CardDescription>{t("sectionSalaryHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <FormField id="salaryMin" label={t("salaryMin")} error={fe.salaryMin}>
              {(p) => <Input {...p} name="salaryMin" type="number" min={0} step="any" defaultValue={values.salaryMin} inputMode="decimal" />}
            </FormField>
            <FormField id="salaryMax" label={t("salaryMax")} error={fe.salaryMax}>
              {(p) => <Input {...p} name="salaryMax" type="number" min={0} step="any" defaultValue={values.salaryMax} inputMode="decimal" />}
            </FormField>
            <FormField id="salaryCurrency" label={t("currency")} error={fe.salaryCurrency}>
              {(p) => (
                <NativeSelect {...p} name="salaryCurrency" defaultValue={values.salaryCurrency || "EUR"}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="salaryPeriod" label={t("period")}>
              {(p) => (
                <NativeSelect {...p} name="salaryPeriod" defaultValue={values.salaryPeriod || "year"}>
                  {SALARY_PERIODS.map((s) => (
                    <option key={s} value={s}>
                      {te(`salaryPeriod.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="benefits" label={t("benefits")} hint={t("listHint")} className="sm:col-span-4">
              {(p) => <Textarea {...p} name="benefits" defaultValue={values.benefits} rows={3} maxLength={3000} />}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sectionEligibility")}</CardTitle>
            <CardDescription>{t("sectionEligibilityHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("workingLanguages")}</legend>
              {fe.workingLanguages && <p className="mb-2 text-xs font-medium text-destructive">{fe.workingLanguages}</p>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WORKING_LANGUAGES.map((l) => (
                  <label key={l} className="flex items-center gap-2 text-sm">
                    <Checkbox name="workingLanguages" value={l} defaultChecked={values.workingLanguages.includes(l)} />
                    {languageName(l)}
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField id="workAuthorization" label={t("workAuthorization")} hint={t("workAuthorizationHint")}>
              {(p) => (
                <NativeSelect {...p} name="workAuthorization" defaultValue={values.workAuthorization || "not_specified"}>
                  {WORK_AUTHORIZATIONS.map((w) => (
                    <option key={w} value={w}>
                      {te(`workAuthorization.${w}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="eligibilityNotes" label={t("eligibilityNotes")} hint={t("eligibilityNotesHint")}>
              {(p) => <Textarea {...p} name="eligibilityNotes" defaultValue={values.eligibilityNotes} rows={2} maxLength={1000} />}
            </FormField>
          </CardContent>
        </Card>
      </fieldset>

      {editable && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <SubmitButton name="intent" value="draft" variant="outline">
            <Save aria-hidden />
            {t("saveDraft")}
          </SubmitButton>
          <SubmitButton name="intent" value="submit">
            <Send aria-hidden />
            {t("submit")}
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
