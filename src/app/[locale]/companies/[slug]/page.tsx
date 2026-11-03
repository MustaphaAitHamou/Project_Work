import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { searchJobs, getRegionNames } from "@/lib/jobs/queries";
import { formatDate } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { CompanyAvatar } from "@/components/companies/company-avatar";
import { JobCard } from "@/components/jobs/job-card";
import { RichText } from "@/components/jobs/rich-text";
import { Badge } from "@/components/ui/badge";

async function getCompany(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { data } = await createPublicClient().from("public_companies").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const c = await getCompany(slug);
  if (!c) return {};
  const t = await getTranslations({ locale, namespace: "companies" });
  return { title: t("companyMetaTitle", { name: c.name! }), description: (c.description ?? "").slice(0, 160) || undefined };
}

export default async function CompanyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const company = await getCompany(slug);
  if (!company) notFound();
  const [t, ti, { items }, regionNames, countryName] = await Promise.all([
    getTranslations("companies"),
    getTranslations("industries"),
    searchJobs({ company: slug, sort: "date" }, locale, 50),
    getRegionNames(),
    getCountryNamer(),
  ]);
  const now = new Date();
  return (
    <div className="container-page py-10">
      <header className="flex flex-wrap items-start gap-5">
        <CompanyAvatar name={company.name ?? ""} logoPath={company.logo_path} className="size-20 text-xl" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{company.name}</h1>
          <p className="text-muted-foreground">
            {ti(company.industry as never)} · {[company.hq_city, countryName(company.country_code)].filter(Boolean).join(", ")}
            {company.size_range && <> · {t("employees", { range: company.size_range })}</>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <ShieldCheck aria-hidden />
              {t("verifiedSince", { date: formatDate(company.verified_at, locale) })}
            </Badge>
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                {t("website")}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      </header>
      {company.description && (
        <section className="mt-8 max-w-3xl">
          <h2 className="mb-2 text-lg font-semibold">{t("about")}</h2>
          <RichText text={company.description} />
        </section>
      )}
      <section className="mt-10" aria-labelledby="company-jobs">
        <h2 id="company-jobs" className="mb-4 text-lg font-semibold">
          {t("openings", { count: items.length })}
        </h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground">{t("noOpenings")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((j) => (
              <li key={j.id}>
                <JobCard job={j} now={now} regionName={j.region_code ? regionNames.get(`${j.country_code}.${j.region_code}`) : null} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
