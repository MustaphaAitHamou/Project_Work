import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SlidersHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getIndustries, getRegionNames, getRegions, searchJobs } from "@/lib/jobs/queries";
import { alertCriteria, hasActiveFilters, PAGE_SIZE, parseSearchParams, toQueryString } from "@/lib/search/params";
import { MARKETS } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { JobCard } from "@/components/jobs/job-card";
import { SearchBar } from "@/components/jobs/search-bar";
import { FiltersForm } from "@/components/jobs/filters-form";
import { SortSelect } from "@/components/jobs/sort-select";
import { CreateAlertButton } from "@/components/jobs/create-alert-button";
import { Pagination } from "@/components/ui/pagination";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const p = parseSearchParams(await searchParams);
  const t = await getTranslations({ locale, namespace: "search" });
  const countryName = await getCountryNamer(locale);
  const where = p.country ? countryName(p.country) : null;
  const title = p.q ? (where ? t("metaTitleQueryIn", { q: p.q, where }) : t("metaTitleQuery", { q: p.q })) : t("metaTitle");
  // Only simple searches are indexable (avoid crawl traps on filter combinations).
  const indexable = Object.keys(alertCriteria(p)).every((k) => k === "q" || k === "country") && !p.page;
  return {
    title,
    description: t("metaDescription"),
    robots: indexable ? undefined : { index: false, follow: true },
    alternates: { canonical: `/${locale}/jobs${p.q || p.country ? `?${toQueryString({ q: p.q, country: p.country })}` : ""}` },
  };
}

export default async function JobsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const p = parseSearchParams(await searchParams);
  const [t, user, { items, total, city }, regions, industries, regionNames] = await Promise.all([
    getTranslations("search"),
    getSessionUser(),
    searchJobs(p, locale),
    p.country ? getRegions(p.country) : Promise.resolve([]),
    getIndustries(),
    getRegionNames(),
  ]);
  const countryName = await getCountryNamer();
  const page = p.page ?? 1;
  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), 250);
  const now = new Date();
  const remoteCountries = [...MARKETS, "DE", "IT", "PT", "NL", "MA", "TN", "SN", "CI"];
  const filters = <FiltersForm params={p} regions={regions} industries={industries} remoteCountries={remoteCountries} />;
  const currentPath = `/jobs${toQueryString(p) ? `?${toQueryString(p)}` : ""}`;

  return (
    <div className="container-page py-8">
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <SearchBar defaultQ={p.q} defaultCity={city?.name ?? p.city} defaultNear={p.near} hidden={{ country: p.country, remoteFrom: p.remoteFrom }} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block" aria-label={t("filters")}>
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pe-1">{filters}</div>
        </aside>
        <section aria-labelledby="results-heading" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="results-heading" className="text-lg font-semibold" aria-live="polite">
                {t("resultsCount", { count: total, formatted: formatNumber(total, locale) })}
              </h2>
              {p.remoteFrom && <p className="text-sm text-muted-foreground">{t("remoteFromActive", { country: countryName(p.remoteFrom) })}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal aria-hidden />
                    {t("filters")}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetTitle className="font-semibold">{t("filters")}</SheetTitle>
                  {filters}
                </SheetContent>
              </Sheet>
              {hasActiveFilters(p) && (
                <CreateAlertButton
                  criteria={alertCriteria(p)}
                  loggedInCandidate={user?.accountType === "candidate"}
                  loginHref={`/login?next=${encodeURIComponent(`/${locale}${currentPath}`)}`}
                />
              )}
              <SortSelect params={p} distanceAvailable={Boolean(city)} />
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-medium">{t("noResults")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("noResultsHint")}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/jobs">{t("resetFilters")}</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} now={now} regionName={job.region_code ? regionNames.get(`${job.country_code}.${job.region_code}`) : null} />
                </li>
              ))}
            </ul>
          )}

          <Pagination page={page} totalPages={totalPages} hrefFor={(n) => `/jobs?${toQueryString(p, { page: n })}`} />
          <p className="text-xs text-muted-foreground">
            {t("rankingNotice")}{" "}
            <Link href="/how-ranking-works" className="underline">
              {t("rankingLink")}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
