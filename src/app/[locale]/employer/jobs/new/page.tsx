import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { EMPTY_JOB, jobFormReference } from "@/lib/employer/job-form-data";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { VerificationBanner } from "@/components/employer/verification-banner";
import { JobForm } from "@/components/employer/job-form";

export default async function NewJobPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const [t, ref] = await Promise.all([getTranslations("employer.jobForm"), jobFormReference()]);
  const defaultCountry = ref.publishableCountries.includes(mine.company.hq_country) ? mine.company.hq_country : mine.company.hq_country;
  return (
    <div className="space-y-6">
      <PageHeader title={t("newTitle")} description={t("newDescription")} />
      <VerificationBanner status={mine.company.verification_status} message={null} />
      <JobForm
        values={{ ...EMPTY_JOB, countryCode: defaultCountry, workingLanguages: [locale === "ar" ? "ar" : locale], salaryCurrency: mine.company.hq_country === "GB" ? "GBP" : mine.company.hq_country === "CH" ? "CHF" : mine.company.hq_country === "US" ? "USD" : mine.company.hq_country === "CA" ? "CAD" : mine.company.hq_country === "DZ" ? "DZD" : "EUR" }}
        regionsByCountry={ref.regionsByCountry}
        industries={ref.industries}
        publishableCountries={ref.publishableCountries}
        editable
        flags={[]}
      />
    </div>
  );
}
