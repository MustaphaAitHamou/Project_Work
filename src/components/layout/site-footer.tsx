import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
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
    <footer className="mt-16 border-t bg-muted/30">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year })}</p>
          <p>{t("notAnAgency")}</p>
        </div>
      </div>
    </footer>
  );
}
