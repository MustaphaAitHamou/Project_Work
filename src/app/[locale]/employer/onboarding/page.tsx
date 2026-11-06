import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { companyFormReference } from "@/lib/employer/form-data";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { CompanyForm } from "@/components/employer/company-form";
import { createCompanyAction } from "../actions";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  if (await getMyCompany(user.id)) redirect(`/${locale}/employer`);
  const [t, ref] = await Promise.all([getTranslations("employer.company"), companyFormReference()]);
  return (
    <div>
      <PageHeader title={t("onboardingTitle")} description={t("onboardingDescription")} />
      <CompanyForm
        mode="create"
        action={createCompanyAction}
        countries={ref.countries}
        regionsByCountry={ref.regionsByCountry}
        industries={ref.industries}
        representative={{ name: `${user.firstName} ${user.lastName}`, email: user.email }}
        values={{
          legalName: "",
          displayName: "",
          registrationCountry: "",
          registrationIdType: "",
          registrationNumber: "",
          registrationRegion: "",
          secondary: {},
          hqAddressLine1: "",
          hqAddressLine2: "",
          hqPostalCode: "",
          hqCity: "",
          hqRegion: "",
          industry: "",
          website: "",
          sizeRange: "",
          representativeTitle: "",
          representativePhone: "",
          isLegalRepresentative: false,
        }}
      />
    </div>
  );
}
