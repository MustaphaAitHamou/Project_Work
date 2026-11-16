import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  BadgeCheck,
  CheckCircle2,
  FileUp,
  Globe2,
  MousePointerClick,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getJobPrice, getLatestJobs, getRegionNames } from "@/lib/jobs/queries";
import { MARKETS } from "@/lib/domain";
import { formatMoneyMinor } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { SearchBar } from "@/components/jobs/search-bar";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/home/country-flag";
import { EmptyBoardIllustration } from "@/components/home/empty-board-illustration";
import { HeroIllustration } from "@/components/home/hero-illustration";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, jobs, price, regionNames, countryName] = await Promise.all([
    getTranslations("home"),
    getLatestJobs(6),
    getJobPrice(null),
    getRegionNames(),
    getCountryNamer(),
  ]);
  const now = new Date();
  const promises = [
    { icon: BadgeCheck, title: t("promise1Title"), text: t("promise1Text") },
    {
      icon: MousePointerClick,
      title: t("promise2Title"),
      text: t("promise2Text"),
    },
    { icon: Globe2, title: t("promise3Title"), text: t("promise3Text") },
    { icon: Scale, title: t("promise4Title"), text: t("promise4Text") },
  ];
  return (
    <>
      {/* Brand band (fixed in both themes): work-blue gradient, white text, original illustration. */}
      <section className="relative overflow-hidden bg-[image:var(--brand-gradient)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 end-[-12%] size-[38rem] rounded-full bg-[#3A62E0] opacity-50 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 start-[-14%] size-[34rem] rounded-full bg-[#0E1A4D] opacity-70 blur-3xl"
        />
        <div className="container-page relative grid items-center gap-10 pt-14 pb-24 sm:pt-20 sm:pb-28 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium">
              <ShieldCheck className="size-3.5" aria-hidden />
              {t("badge")}
            </p>
            <h1 className="text-4xl font-extrabold sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-xl text-lg">{t("subtitle")}</p>
            <nav
              aria-label={t("countriesLabel")}
              className="mt-8 flex flex-wrap gap-2"
            >
              {MARKETS.map((c) => (
                <Link
                  key={c}
                  href={`/jobs?country=${c}`}
                  className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-sm transition-colors hover:border-white/60 hover:bg-white/20"
                >
                  <CountryFlag code={c} />
                  {countryName(c)}
                </Link>
              ))}
            </nav>
          </div>
          <HeroIllustration className="hidden w-full max-w-[540px] justify-self-end lg:block" />
        </div>
      </section>

      {/* Full-width search, straddling the bottom edge of the brand band. */}
      <div className="container-page relative z-10 -mt-12">
        <SearchBar size="lg" />
      </div>

      <section className="container-page py-14" aria-labelledby="promises">
        <h2 id="promises" className="sr-only">
          {t("promisesTitle")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="grid size-12 place-items-center rounded-md bg-secondary text-primary">
                <p.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-14" aria-labelledby="latest">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="latest" className="text-2xl font-bold">
            {t("latestTitle")}
          </h2>
          <Link
            href="/jobs?sort=date"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("seeAllJobs")}
          </Link>
        </div>
        {jobs.length === 0 ? (
          <div className="grid items-center gap-6 rounded-xl border border-dashed bg-card/60 p-8 sm:grid-cols-[auto_1fr] sm:gap-10">
            <EmptyBoardIllustration className="mx-auto w-52 sm:w-60" />
            <div className="text-center sm:text-start">
              <p className="text-xl font-bold">{t("noJobsYet")}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
                <Button asChild>
                  <Link href="/signup">{t("ctaCandidate")}</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/recruiters">{t("ctaRecruiter")}</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <li key={j.id}>
                <JobCard
                  job={j}
                  now={now}
                  regionName={
                    j.region_code
                      ? regionNames.get(`${j.country_code}.${j.region_code}`)
                      : null
                  }
                />
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
          <div className="relative mt-14">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[17%] top-0 hidden border-t-2 border-dashed border-primary/40 md:block"
            />
            <ol className="relative grid gap-12 md:grid-cols-3 md:gap-6">
              {[
                {
                  icon: UserRound,
                  title: t("step1Title"),
                  text: t("step1Text"),
                },
                { icon: FileUp, title: t("step2Title"), text: t("step2Text") },
                {
                  icon: MousePointerClick,
                  title: t("step3Title"),
                  text: t("step3Text"),
                },
              ].map((s, i) => (
                <li
                  key={s.title}
                  className="relative rounded-xl border bg-card px-6 pt-11 pb-6 text-center"
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -top-7 mx-auto grid size-14 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground shadow-lg"
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {t("stepLabel", { n: i + 1 })}
                  </span>
                  <span className="mx-auto mt-3 grid size-12 place-items-center rounded-md bg-secondary text-primary">
                    <s.icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {s.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
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
            <ul className="mt-5 space-y-3 text-sm">
              {[
                t("recruitersPoint1"),
                t("recruitersPoint2"),
                t("recruitersPoint3"),
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-[image:var(--brand-gradient)] p-6 text-center text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -end-16 -top-16 size-48 rounded-full bg-white/10"
            />
            {price ? (
              <>
                <p className="relative text-sm">{t("priceFrom")}</p>
                <p className="relative mt-1 text-4xl font-extrabold">
                  {formatMoneyMinor(price.unit_amount, price.currency, locale)}
                </p>
                <p className="relative text-sm">{t("pricePer")}</p>
                <p className="relative mt-1 text-xs">{t("priceTaxes")}</p>
              </>
            ) : null}
            <Button asChild variant="inverse" className="relative mt-4 w-full">
              <Link href="/recruiters">{t("ctaRecruiter")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
