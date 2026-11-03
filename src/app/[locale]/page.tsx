import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, FileUp, Globe2, MousePointerClick, Scale, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getJobPrice, getLatestJobs, getRegionNames } from "@/lib/jobs/queries";
import { MARKETS } from "@/lib/domain";
import { countryFlag, formatMoneyMinor } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { SearchBar } from "@/components/jobs/search-bar";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, jobs, price, regionNames, countryName] = await Promise.all([getTranslations("home"), getLatestJobs(6), getJobPrice(null), getRegionNames(), getCountryNamer()]);
  const now = new Date();
  const promises = [
    { icon: BadgeCheck, title: t("promise1Title"), text: t("promise1Text") },
    { icon: MousePointerClick, title: t("promise2Title"), text: t("promise2Text") },
    { icon: Globe2, title: t("promise3Title"), text: t("promise3Text") },
    { icon: Scale, title: t("promise4Title"), text: t("promise4Text") },
  ];
  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container-page py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
              {t("badge")}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="mx-auto mt-10 max-w-4xl">
            <SearchBar size="lg" />
          </div>
          <nav aria-label={t("countriesLabel")} className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-2">
            {MARKETS.map((c) => (
              <Link key={c} href={`/jobs?country=${c}`} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
                <span aria-hidden>{countryFlag(c)} </span>
                {countryName(c)}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="promises">
        <h2 id="promises" className="sr-only">
          {t("promisesTitle")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map((p) => (
            <div key={p.title} className="rounded-xl border bg-card p-5">
              <p.icon className="size-6 text-primary" aria-hidden />
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-14" aria-labelledby="latest">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="latest" className="text-2xl font-bold">
            {t("latestTitle")}
          </h2>
          <Link href="/jobs?sort=date" className="text-sm font-medium text-primary hover:underline">
            {t("seeAllJobs")}
          </Link>
        </div>
        {jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t("noJobsYet")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <li key={j.id}>
                <JobCard job={j} now={now} regionName={j.region_code ? regionNames.get(`${j.country_code}.${j.region_code}`) : null} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-y bg-muted/30" aria-labelledby="how">
        <div className="container-page py-14">
          <h2 id="how" className="text-center text-2xl font-bold">
            {t("howTitle")}
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { icon: UserRound, title: t("step1Title"), text: t("step1Text") },
              { icon: FileUp, title: t("step2Title"), text: t("step2Text") },
              { icon: MousePointerClick, title: t("step3Title"), text: t("step3Text") },
            ].map((s, i) => (
              <li key={s.title} className="rounded-xl border bg-card p-6">
                <span className="text-sm font-semibold text-primary">{t("stepLabel", { n: i + 1 })}</span>
                <s.icon className="mt-3 size-7 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">{t("ctaCandidate")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container-page py-14" aria-labelledby="recruiters">
        <div className="grid items-center gap-8 rounded-2xl border bg-card p-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 id="recruiters" className="text-2xl font-bold">
              {t("recruitersTitle")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("recruitersText")}</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✓ {t("recruitersPoint1")}</li>
              <li>✓ {t("recruitersPoint2")}</li>
              <li>✓ {t("recruitersPoint3")}</li>
            </ul>
          </div>
          <div className="rounded-xl bg-primary/5 p-6 text-center">
            {price ? (
              <>
                <p className="text-sm text-muted-foreground">{t("priceFrom")}</p>
                <p className="mt-1 text-4xl font-bold text-primary">{formatMoneyMinor(price.unit_amount, price.currency, locale)}</p>
                <p className="text-sm text-muted-foreground">{t("pricePer")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("priceTaxes")}</p>
              </>
            ) : null}
            <Button asChild className="mt-4 w-full">
              <Link href="/recruiters">{t("ctaRecruiter")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
