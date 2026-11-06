import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { companyFormReference } from "@/lib/employer/form-data";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { CompanyProfileForm } from "@/components/employer/company-profile-form";
import { CompanyForm } from "@/components/employer/company-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateRegistrationAction } from "../actions";

export default async function CompanyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const [t, ref] = await Promise.all([getTranslations("employer.company"), companyFormReference()]);
  const c = mine.company;
  const canEdit = mine.member.role !== "recruiter" && !c.suspended_at;
  const registrationEditable = canEdit && ["pending", "manual_review", "rejected"].includes(c.verification_status);
  return (
    <div className="space-y-6">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <CompanyProfileForm company={c} industries={ref.industries} canEdit={canEdit} />
      {registrationEditable ? (
        <CompanyForm
          mode="edit"
          action={updateRegistrationAction}
          countries={[c.registration_country]}
          regionsByCountry={ref.regionsByCountry}
          industries={ref.industries}
          representative={{ name: `${user.firstName} ${user.lastName}`, email: user.email }}
          values={{
            companyId: c.id,
            legalName: c.legal_name,
            displayName: c.display_name ?? "",
            registrationCountry: c.registration_country,
            registrationIdType: c.registration_id_type,
            registrationNumber: c.registration_number,
            registrationRegion: c.registration_region ?? "",
            secondary: (c.secondary_identifiers as Record<string, string>) ?? {},
            hqAddressLine1: c.hq_address_line1,
            hqAddressLine2: c.hq_address_line2 ?? "",
            hqPostalCode: c.hq_postal_code ?? "",
            hqCity: c.hq_city,
            hqRegion: c.hq_region ?? "",
            industry: c.industry,
            website: c.website ?? "",
            sizeRange: c.size_range ?? "",
            representativeTitle: mine.member.job_title ?? "",
            representativePhone: mine.member.phone ?? "",
            isLegalRepresentative: mine.member.is_legal_representative,
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("registrationTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("legalName")}</dt>
                <dd className="font-medium">{c.legal_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t(`idTypes.${c.registration_id_type}` as never)}</dt>
                <dd className="font-medium">{c.registration_number}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t("hqTitle")}</dt>
                <dd>{[c.hq_address_line1, c.hq_address_line2, `${c.hq_postal_code ?? ""} ${c.hq_city}`.trim()].filter(Boolean).join(", ")}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">{t("lockedHint")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
