import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { MARKETS } from "@/lib/domain";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { CompanyAvatar } from "@/components/companies/company-avatar";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "companies" });
  return { title: t("title"), description: t("description") };
}

export default async function CompaniesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; country?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, ti, countryName] = await Promise.all([getTranslations("companies"), getTranslations("industries"), getCountryNamer()]);
  let query = createPublicClient().from("public_companies").select("*").order("active_jobs_count", { ascending: false }).order("name").limit(60);
  const q = (sp.q ?? "").trim().slice(0, 80);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  if (sp.country && (MARKETS as readonly string[]).includes(sp.country)) query = query.eq("country_code", sp.country);
  const { data: companies } = await query;
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("description")}</p>
      <form method="get" className="mt-6 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="company-q">
          {t("searchLabel")}
        </label>
        <Input id="company-q" name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="max-w-sm" />
        <label className="sr-only" htmlFor="company-country">
          {t("country")}
        </label>
        <NativeSelect id="company-country" name="country" defaultValue={sp.country ?? ""} className="w-56">
          <option value="">{t("allCountries")}</option>
          {MARKETS.map((c) => (
            <option key={c} value={c}>
              {countryName(c)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">{t("search")}</Button>
      </form>
      {!companies?.length ? (
        <p className="mt-10 rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <li key={c.id} className="relative flex gap-4 rounded-xl border bg-card p-5 hover:shadow-sm">
              <CompanyAvatar name={c.name ?? ""} logoPath={c.logo_path} />
              <div className="min-w-0">
                <h2 className="font-semibold">
                  <Link href={`/companies/${c.slug}`} className="after:absolute after:inset-0 hover:text-primary">
                    {c.name}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {ti(c.industry as never)} · {[c.hq_city, countryName(c.country_code)].filter(Boolean).join(", ")}
                </p>
                <p className="mt-1 text-sm font-medium text-primary">{t("activeJobs", { count: Number(c.active_jobs_count ?? 0) })}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
