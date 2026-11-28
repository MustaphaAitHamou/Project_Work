import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdSlot } from "@/components/ads/ad-slot";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getJobPrice, getLatestJobs, getRegionNames } from "@/lib/jobs/queries";
import { MARKETS } from "@/lib/domain";
import { formatMoneyMinor } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { getSessionUser } from "@/lib/auth/session";
import { getLaunchOffer } from "@/lib/billing/launch-offer";
import { offerFirstPaidDay, offerLastDay } from "@/lib/billing/offer";
import { LaunchOfferBanner } from "@/components/billing/launch-offer-banner";
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
  const [t, tNav, tOffer, user, jobs, price, regionNames, countryName, offer] = await Promise.all([
    getTranslations("home"),
    getTranslations("nav"),
    getTranslations("launchOffer"),
    getSessionUser(),
    getLatestJobs(6),
    getJobPrice(null),
    getRegionNames(),
    getCountryNamer(),
    getLaunchOffer(),
  ]);
  // Launch offer (free publication): shown while the database accepts it.
  const launch = offer?.open ? { lastDay: offerLastDay(offer.freeUntil, locale), startDay: offerFirstPaidDay(offer.freeUntil, locale) } : null;
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
      <LaunchOfferBanner />
      {/* Brand band (fixed in both themes): work-blue gradient, white text, original illustration. */}
      <section className="relative overflow-hidden bg-[image:var(--brand-gradient)] text-white [--ring:var(--highlight)]">
        {/* Fine grid fading out from the top: texture without noise. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_30%_0%,#000_40%,transparent_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 start-[-10%] size-[30rem] rounded-full bg-teal-bright opacity-[0.12] blur-3xl"
        />
        <div className="container-page relative grid items-center gap-10 pt-10 pb-20 sm:pt-16 sm:pb-24 lg:grid-cols-[1.08fr_0.92fr] lg:pt-20 lg:pb-28">
          <div className="min-w-0">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm">
              <ShieldCheck className="size-3.5 text-teal-bright" aria-hidden />
              {t("badge")}
            </p>
            <h1 className="text-[2.4rem] leading-[1.06] font-extrabold sm:text-5xl lg:text-[3.6rem]">
              {t("title")}
            </h1>
            <div aria-hidden className="mt-5 h-1 w-16 rounded-full bg-highlight" />
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">{t("subtitle")}</p>
            <nav
              aria-label={t("countriesLabel")}
              className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              {MARKETS.map((c) => (
                <Link
                  key={c}
                  href={`/jobs?country=${c}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/20"
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
        <div aria-hidden className="mx-auto mt-4 h-1 w-12 rounded-full bg-highlight" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:gap-6">
          {promises.map((p) => (
            <article
              key={p.title}
              className="group grid items-center gap-6 rounded-3xl border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:grid-cols-[176px_1fr] sm:p-6"
            >
              <div className="grid h-40 place-items-center rounded-2xl bg-[linear-gradient(160deg,var(--secondary),color-mix(in_oklab,var(--secondary)_40%,var(--card)))] px-3 ring-1 ring-primary/5">
                {p.art}
              </div>
              <div>
                <h3 className="text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
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
      <section className="border-y bg-[linear-gradient(180deg,color-mix(in_oklab,var(--secondary)_70%,var(--background)),var(--background))]" aria-labelledby="how">
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
                <div className="relative grid h-48 place-items-center rounded-3xl border bg-card p-5 shadow-sm">
                  {s.art}
                  <span
                    aria-hidden
                    className="font-display absolute -top-5 start-5 grid size-12 place-items-center rounded-2xl bg-brand-deep text-xl font-extrabold text-brand-on shadow-lg ring-4 ring-highlight/80"
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
        <div className="grid items-center gap-10 rounded-3xl border bg-card p-6 shadow-sm sm:p-10 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h2 id="recruiters" className="text-3xl font-extrabold">
              {t("recruitersTitle")}
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              {t("recruitersText")}
            </p>
            <ul className="mt-6 space-y-3 text-base">
              {[
                ...(launch ? [t("recruitersPointLaunch", { lastDay: launch.lastDay })] : []),
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
            <div className="relative mt-8 flex flex-col gap-5 overflow-hidden rounded-2xl bg-[image:var(--brand-gradient)] p-6 text-white shadow-lg [--ring:var(--highlight)] sm:flex-row sm:items-center sm:justify-between">
              <div
                aria-hidden
                className="pointer-events-none absolute -end-14 -top-16 size-44 rounded-full bg-white/10"
              />
              {launch ? (
                <div className="relative">
                  <p className="inline-flex rounded-full bg-highlight px-2.5 py-0.5 text-xs font-bold text-highlight-foreground">
                    {tOffer("badge")}
                  </p>
                  <p className="mt-2 text-4xl font-extrabold">{tOffer("free")}</p>
                  <p className="text-sm font-semibold">
                    {tOffer("freeUntil", { lastDay: launch.lastDay })}
                  </p>
                  {price ? (
                    <p className="mt-1 text-sm text-white/85">
                      {tOffer(
                        price.tax_behavior === "inclusive"
                          ? "thenInclusive"
                          : "then",
                        {
                          price: formatMoneyMinor(
                            price.unit_amount,
                            price.currency,
                            locale,
                          ),
                          startDay: launch.startDay,
                        },
                      )}
                    </p>
                  ) : null}
                </div>
              ) : price ? (
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
          <div className="rounded-2xl bg-[linear-gradient(160deg,var(--secondary),color-mix(in_oklab,var(--secondary)_40%,var(--card)))] p-4 ring-1 ring-primary/5 sm:p-6">
            <DashboardSpot className="w-full" />
          </div>
        </div>
      </section>
      <div className="container-page">
        <AdSlot placement="home" />
      </div>
    </>
  );
}
