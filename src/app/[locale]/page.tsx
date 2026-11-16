import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getJobPrice, getLatestJobs, getRegionNames } from "@/lib/jobs/queries";
import { MARKETS } from "@/lib/domain";
import { formatMoneyMinor } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { getSessionUser } from "@/lib/auth/session";
import { SearchBar } from "@/components/jobs/search-bar";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/home/country-flag";
import { EmptyBoardIllustration } from "@/components/home/empty-board-illustration";
import { HeroIllustration } from "@/components/home/hero-illustration";
import {
  DashboardSpot,
  EqualitySpot,
  OneClickSpot,
  ProfileSpot,
  SendSpot,
  UploadSpot,
  VerifiedSpot,
} from "@/components/home/spot-illustrations";

/** The nine markets as a little cluster of flags, for the "9 markets" promise. */
function MarketsSpot() {
  return (
    <div className="grid size-32 place-items-center rounded-full border-2 border-dashed border-primary/35 bg-card">
      <div className="grid grid-cols-3 gap-1.5">
        {MARKETS.map((c) => (
          <CountryFlag key={c} code={c} className="h-[18px] w-[27px]" />
        ))}
      </div>
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tNav, user, jobs, price, regionNames, countryName] = await Promise.all([
    getTranslations("home"),
    getTranslations("nav"),
    getSessionUser(),
    getLatestJobs(6),
    getJobPrice(null),
    getRegionNames(),
    getCountryNamer(),
  ]);
  const now = new Date();
  // Signed-in users are never sent to the sign-up page: they go to their own space.
  const candidateCta = !user
    ? { href: "/signup", label: t("ctaCandidate") }
    : user.accountType === "candidate"
      ? { href: "/candidate/profile", label: tNav("myProfile") }
      : { href: "/employer", label: tNav("dashboard") };
  const spot = "w-full max-w-[176px]";
  const promises = [
    {
      art: <VerifiedSpot className={spot} />,
      title: t("promise1Title"),
      text: t("promise1Text"),
    },
    {
      art: <OneClickSpot className={spot} />,
      title: t("promise2Title"),
      text: t("promise2Text"),
    },
    {
      art: <MarketsSpot />,
      title: t("promise3Title"),
      text: t("promise3Text"),
    },
    {
      art: <EqualitySpot className={spot} />,
      title: t("promise4Title"),
      text: t("promise4Text"),
    },
  ];
  const steps = [
    {
      art: <ProfileSpot className="w-full max-w-[200px]" />,
      title: t("step1Title"),
      text: t("step1Text"),
    },
    {
      art: <UploadSpot className="w-full max-w-[200px]" />,
      title: t("step2Title"),
      text: t("step2Text"),
    },
    {
      art: <SendSpot className="w-full max-w-[200px]" />,
      title: t("step3Title"),
      text: t("step3Text"),
    },
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

      {/* Commitments: four large tiles, each with its own illustration. */}
      <section
        className="container-page py-16 sm:py-20"
        aria-labelledby="promises"
      >
        <h2
          id="promises"
          className="text-center text-3xl font-extrabold sm:text-4xl"
        >
          {t("promisesTitle")}
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {promises.map((p) => (
            <article
              key={p.title}
              className="grid items-center gap-6 rounded-xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:grid-cols-[184px_1fr]"
            >
              <div className="grid h-40 place-items-center rounded-md bg-secondary px-3">
                {p.art}
              </div>
              <div>
                <h3 className="text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  {p.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="container-page pb-16 sm:pb-20"
        aria-labelledby="latest"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="latest" className="text-3xl font-extrabold">
            {t("latestTitle")}
          </h2>
          <Link
            href="/jobs?sort=date"
            className="text-sm font-bold text-primary hover:underline"
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
                  <Link href={candidateCta.href}>{candidateCta.label}</Link>
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

      {/* How it works: a tinted band, one illustration per step. */}
      <section className="bg-secondary/70" aria-labelledby="how">
        <div className="container-page py-16 sm:py-20">
          <h2
            id="how"
            className="text-center text-3xl font-extrabold sm:text-4xl"
          >
            {t("howTitle")}
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((s, i) => (
              <li key={s.title}>
                <div className="relative grid h-48 place-items-center rounded-xl border bg-card p-5 shadow-sm">
                  {s.art}
                  <span
                    aria-hidden
                    className="absolute -top-5 start-5 grid size-12 place-items-center rounded-full bg-primary text-xl font-extrabold text-primary-foreground shadow-lg"
                  >
                    {i + 1}
                  </span>
                </div>
                <p className="mt-6 text-sm font-bold tracking-[0.08em] text-primary uppercase">
                  {t("stepLabel", { n: i + 1 })}
                </p>
                <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  {s.text}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex justify-center">
            <Button asChild size="lg">
              <Link href={candidateCta.href}>{candidateCta.label}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Recruiters: the applications dashboard next to the pitch and the price. */}
      <section
        className="container-page py-16 sm:py-20"
        aria-labelledby="recruiters"
      >
        <div className="grid items-center gap-10 rounded-2xl border bg-card p-6 sm:p-10 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h2 id="recruiters" className="text-3xl font-extrabold">
              {t("recruitersTitle")}
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              {t("recruitersText")}
            </p>
            <ul className="mt-6 space-y-3 text-base">
              {[
                t("recruitersPoint1"),
                t("recruitersPoint2"),
                t("recruitersPoint3"),
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  {point}
                </li>
              ))}
            </ul>
            <div className="relative mt-8 flex flex-col gap-5 overflow-hidden rounded-xl bg-[image:var(--brand-gradient)] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
              <div
                aria-hidden
                className="pointer-events-none absolute -end-14 -top-16 size-44 rounded-full bg-white/10"
              />
              {price ? (
                <div className="relative">
                  <p className="text-sm">{t("priceFrom")}</p>
                  <p className="text-4xl font-extrabold">
                    {formatMoneyMinor(
                      price.unit_amount,
                      price.currency,
                      locale,
                    )}
                  </p>
                  <p className="text-sm">
                    {t("pricePer")} · {t("priceTaxes")}
                  </p>
                </div>
              ) : null}
              <Button asChild variant="inverse" className="relative shrink-0">
                <Link href="/recruiters">{t("ctaRecruiter")}</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-xl bg-secondary p-4 sm:p-6">
            <DashboardSpot className="w-full" />
          </div>
        </div>
      </section>
    </>
  );
}
