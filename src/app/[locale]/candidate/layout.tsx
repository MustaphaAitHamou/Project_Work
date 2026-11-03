import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCandidate } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function CandidateLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCandidate(locale, `/${locale}/candidate`);
  const t = await getTranslations("candidate.nav");
  return (
    <DashboardShell
      title={t("title")}
      items={[
        { href: "/candidate", label: t("overview"), icon: "dashboard", exact: true },
        { href: "/candidate/profile", label: t("profile"), icon: "user" },
        { href: "/candidate/resumes", label: t("resumes"), icon: "file" },
        { href: "/candidate/applications", label: t("applications"), icon: "briefcase" },
        { href: "/candidate/saved", label: t("saved"), icon: "bookmark" },
        { href: "/candidate/alerts", label: t("alerts"), icon: "bell" },
        { href: "/candidate/settings", label: t("settings"), icon: "settings" },
        { href: "/candidate/privacy", label: t("privacy"), icon: "shieldCheck" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
