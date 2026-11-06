import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireEmployer } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function EmployerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireEmployer(locale, `/${locale}/employer`);
  const t = await getTranslations("employer.nav");
  return (
    <DashboardShell
      title={t("title")}
      items={[
        { href: "/employer", label: t("overview"), icon: "dashboard", exact: true },
        { href: "/employer/jobs", label: t("jobs"), icon: "briefcase" },
        { href: "/employer/company", label: t("company"), icon: "building" },
        { href: "/employer/verification", label: t("verification"), icon: "shieldCheck" },
        { href: "/employer/billing", label: t("billing"), icon: "card" },
        { href: "/employer/settings", label: t("settings"), icon: "settings" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
