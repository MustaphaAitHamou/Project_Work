"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { COMPANY_SIZES } from "@/lib/domain";
import { ID_TYPES, idTypesForCountry, type IdTypeCode } from "@/lib/companies/identifiers";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { useCountryName } from "@/lib/i18n/names";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";

export interface CompanyFormValues {
  companyId?: string;
  legalName: string;
  displayName: string;
  registrationCountry: string;
  registrationIdType: string;
  registrationNumber: string;
  registrationRegion: string;
  secondary: Record<string, string>;
  hqAddressLine1: string;
  hqAddressLine2: string;
  hqPostalCode: string;
  hqCity: string;
  hqRegion: string;
  industry: string;
  website: string;
  sizeRange: string;
  representativeTitle: string;
  representativePhone: string;
  isLegalRepresentative: boolean;
}

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function CompanyForm({
  action: serverAction,
  values,
  countries,
  regionsByCountry,
  industries,
  representative,
  mode,
}: {
  action: Action;
  values: CompanyFormValues;
  countries: string[];
  regionsByCountry: Record<string, { code: string; name: string }[]>;
  industries: string[];
  representative: { name: string; email: string };
  mode: "create" | "edit";
}) {
  const t = useTranslations("employer.company");
  const ti = useTranslations("industries");
  const locale = useLocale();
  const countryName = useCountryName();
  const [state, action] = useActionState(serverAction, initialActionState);
  const [country, setCountry] = useState(values.registrationCountry || countries[0] || "FR");
  const idTypes = useMemo(() => idTypesForCountry(country), [country]);
  const [idType, setIdType] = useState<string>(values.registrationIdType && ID_TYPES[values.registrationIdType as IdTypeCode]?.country === country ? values.registrationIdType : (idTypes[0]?.code ?? ""));
  const def = ID_TYPES[idType as IdTypeCode] ?? idTypes[0];
  const fe = state.fieldErrors ?? {};
  const regions = regionsByCountry[country] ?? [];
  const needsRegion = Boolean(def?.requiresRegion) || country === "US";

  return (
    <ActionForm action={action} className="space-y-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {values.companyId && <input type="hidden" name="companyId" value={values.companyId} />}
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle>{t("registrationTitle")}</CardTitle>
          <CardDescription>{t("registrationHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="registrationCountry" label={t("registrationCountry")} required>
            {(p) => (
              <NativeSelect
                {...p}
                name="registrationCountry"
                value={country}
                disabled={mode === "edit"}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setIdType(idTypesForCountry(e.target.value)[0]?.code ?? "");
                }}
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {countryName(c)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {mode === "edit" && <input type="hidden" name="registrationCountry" value={country} />}
          <FormField id="registrationIdType" label={t("idType")} required error={fe.registrationIdType}>
            {(p) => (
              <NativeSelect {...p} name="registrationIdType" value={idType} onChange={(e) => setIdType(e.target.value)}>
                {idTypes.map((d) => (
                  <option key={d.code} value={d.code}>
                    {t(`idTypes.${d.code}` as never)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="registrationNumber" label={t("registrationNumber")} hint={def ? t(`idHints.${def.code}` as never) : undefined} required error={fe.registrationNumber}>
            {(p) => <Input {...p} name="registrationNumber" defaultValue={values.registrationNumber} placeholder={def?.placeholder} autoComplete="off" maxLength={40} />}
          </FormField>
          {needsRegion && (
            <FormField id="registrationRegion" label={t(country === "US" ? "stateOfIncorporation" : "provinceOfRegistration")} required error={fe.registrationRegion}>
              {(p) => (
                <NativeSelect {...p} name="registrationRegion" defaultValue={values.registrationRegion}>
                  <option value="">{t("choose")}</option>
                  {regions.map((r) => (
                    <option key={r.code} value={country === "CA" ? CA_PROVINCE_CODES[r.code] ?? r.code : r.code}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
          {def?.secondary.map((code) => (
            <FormField
              key={code}
              id={`secondary-${code}`}
              label={t(`secondary.${code}` as never)}
              hint={t(`secondaryHints.${code}` as never)}
              error={fe[`secondary.${code}`]}
            >
              {(p) => <Input {...p} name={`secondary.${code}`} defaultValue={values.secondary[code] ?? ""} autoComplete="off" maxLength={40} />}
            </FormField>
          ))}
          <FormField id="legalName" label={t("legalName")} hint={t("legalNameHint")} required error={fe.legalName}>
            {(p) => <Input {...p} name="legalName" defaultValue={values.legalName} maxLength={200} />}
          </FormField>
          {mode === "create" && (
            <FormField id="displayName" label={t("displayName")} hint={t("displayNameHint")}>
              {(p) => <Input {...p} name="displayName" defaultValue={values.displayName} maxLength={200} />}
            </FormField>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("hqTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="hqAddressLine1" label={t("addressLine1")} required error={fe.hqAddressLine1} className="sm:col-span-2">
            {(p) => <Input {...p} name="hqAddressLine1" defaultValue={values.hqAddressLine1} autoComplete="address-line1" maxLength={200} />}
          </FormField>
          <FormField id="hqAddressLine2" label={t("addressLine2")} className="sm:col-span-2">
            {(p) => <Input {...p} name="hqAddressLine2" defaultValue={values.hqAddressLine2} autoComplete="address-line2" maxLength={200} />}
          </FormField>
          <FormField id="hqPostalCode" label={t("postalCode")}>
            {(p) => <Input {...p} name="hqPostalCode" defaultValue={values.hqPostalCode} autoComplete="postal-code" maxLength={20} />}
          </FormField>
          <FormField id="hqCity" label={t("city")} required error={fe.hqCity}>
            {(p) => <Input {...p} name="hqCity" defaultValue={values.hqCity} autoComplete="address-level2" maxLength={120} />}
          </FormField>
          <FormField id="hqRegion" label={t("region")}>
            {(p) => <Input {...p} name="hqRegion" defaultValue={values.hqRegion} autoComplete="address-level1" maxLength={120} />}
          </FormField>
        </CardContent>
      </Card>

      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("profileTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id="industry" label={t("industry")} required error={fe.industry}>
              {(p) => (
                <NativeSelect {...p} name="industry" defaultValue={values.industry || "other"}>
                  {industries.map((i) => (
                    <option key={i} value={i}>
                      {ti(i as never)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="sizeRange" label={t("size")}>
              {(p) => (
                <NativeSelect {...p} name="sizeRange" defaultValue={values.sizeRange}>
                  <option value="">{t("choose")}</option>
                  {COMPANY_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {t("employees", { range: s })}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="website" label={t("website")} hint={t("websiteHint")} error={fe.website} className="sm:col-span-2">
              {(p) => <Input {...p} name="website" type="url" inputMode="url" defaultValue={values.website} placeholder="https://" maxLength={200} />}
            </FormField>
          </CardContent>
        </Card>
      )}
      {mode === "edit" && (
        <>
          <input type="hidden" name="industry" value={values.industry} />
          <input type="hidden" name="website" value={values.website} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("representativeTitleSection")}</CardTitle>
          <CardDescription>{t("representativeHint", { name: representative.name, email: representative.email })}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="representativeTitle" label={t("representativeTitle")} hint={t("representativeTitleHint")} required error={fe.representativeTitle}>
            {(p) => <Input {...p} name="representativeTitle" defaultValue={values.representativeTitle} autoComplete="organization-title" maxLength={120} />}
          </FormField>
          <FormField id="representativePhone" label={t("representativePhone")} error={fe.representativePhone}>
            {(p) => <Input {...p} name="representativePhone" type="tel" defaultValue={values.representativePhone} autoComplete="tel" maxLength={25} />}
          </FormField>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <Checkbox name="isLegalRepresentative" defaultChecked={values.isLegalRepresentative} className="mt-0.5" />
            <span>{t("isLegalRepresentative")}</span>
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">{t("dataMinimisation")}</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel={t("checking")}>
          {mode === "create" ? t("submitCreate") : t("submitEdit")}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** GeoNames numeric codes for Canadian provinces -> ISO 3166-2 sub-codes (used for registry lookups). */
const CA_PROVINCE_CODES: Record<string, string> = {
  "01": "AB", "02": "BC", "03": "MB", "04": "NB", "05": "NL", "07": "NS", "08": "ON", "09": "PE", "10": "QC", "11": "SK", "12": "YT", "13": "NT", "14": "NU",
};
