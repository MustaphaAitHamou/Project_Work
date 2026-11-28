import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAdsConfig } from "@/lib/ads/config";
import { CookieSettingsLink } from "@/components/ads/cookie-settings-link";
import { Logo } from "./logo";

export async function SiteFooter() {
  const [t, ads] = await Promise.all([getTranslations("footer"), getAdsConfig()]);
  const year = new Date().getUTCFullYear();
  const columns = [
    {
      title: t("candidates"),
      links: [
        { href: "/jobs", label: t("searchJobs") },
        { href: "/cv", label: t("uploadCv") },
        { href: "/signup", label: t("createAccount") },
      ],
    },
    {
      title: t("recruiters"),
      links: [
        { href: "/recruiters", label: t("publishJob") },
        { href: "/signup/employer", label: t("createEmployerAccount") },
        { href: "/companies", label: t("companies") },
      ],
    },
    {
      title: t("about"),
      links: [
        { href: "/about", label: t("ourCommitment") },
        { href: "/how-ranking-works", label: t("ranking") },
        { href: "/legal/terms", label: t("terms") },
        { href: "/legal/employer-terms", label: t("employerTerms") },
        { href: "/legal/privacy", label: t("privacy") },
        { href: "/legal/cookies", label: t("cookies") },
        { href: "/legal/notice", label: t("legalNotice") },
      ],
    },
  ];
  return (
    <footer className="relative mt-20 overflow-hidden bg-brand-deep text-brand-on [--ring:var(--highlight)]">
      {/* Night blue in both themes, with a thin yellow and turquoise line on top. */}
      <div aria-hidden className="h-1 bg-[linear-gradient(90deg,var(--highlight)_0%,var(--highlight)_33%,var(--teal-bright)_33%,var(--teal-bright)_66%,#3557e8_66%)]" />
      <div aria-hidden className="pointer-events-none absolute -end-32 -top-40 size-[28rem] rounded-full bg-[#2446d6] opacity-25 blur-3xl" />
      <div className="container-page relative grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo onDark />
          <p className="max-w-xs text-sm leading-relaxed text-brand-on/75">{t("tagline")}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-4">
            <h2 className="text-sm font-bold tracking-[-0.01em] text-brand-on">{col.title}</h2>
            <ul className="space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-brand-on/70 transition-colors hover:text-brand-on hover:underline hover:underline-offset-4">
                    {l.label}
                  </Link>
                </li>
              ))}
              {col.title === t("about") && ads.enabled && ads.mode !== "placeholder" && (
                <li>
                  <CookieSettingsLink label={t("cookieSettings")} className="text-brand-on/70 transition-colors hover:text-brand-on" />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-brand-on/65 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year })}</p>
          <p>{t("notAnAgency")}</p>
        </div>
      </div>
    </footer>
  );
}
