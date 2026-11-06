import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { DashboardNavItem } from "@/components/layout/dashboard-nav";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission(locale, "dashboard.view");
  const t = await getTranslations("admin.nav");
  const all: (DashboardNavItem & { permission: Permission })[] = [
    { href: "/admin", label: t("dashboard"), icon: "chart", exact: true, permission: "dashboard.view" },
    { href: "/admin/companies", label: t("companies"), icon: "building", permission: "companies.view" },
    { href: "/admin/jobs", label: t("jobs"), icon: "briefcase", permission: "jobs.view" },
    { href: "/admin/reports", label: t("reports"), icon: "flag", permission: "reports.handle" },
    { href: "/admin/users", label: t("users"), icon: "users", permission: "users.view" },
    { href: "/admin/countries", label: t("countries"), icon: "globe", permission: "countries.manage" },
    { href: "/admin/pricing", label: t("pricing"), icon: "tags", permission: "pricing.manage" },
    { href: "/admin/payments", label: t("payments"), icon: "wallet", permission: "payments.view" },
    { href: "/admin/privacy", label: t("privacy"), icon: "shieldCheck", permission: "privacy.handle" },
    { href: "/admin/moderation", label: t("moderation"), icon: "shield", permission: "moderation_terms.manage" },
    { href: "/admin/emails", label: t("emails"), icon: "mail", permission: "emails.manage" },
    { href: "/admin/audit", label: t("audit"), icon: "scroll", permission: "audit.view" },
    { href: "/admin/settings", label: t("settings"), icon: "key", permission: "settings.manage" },
  ];
  const items = all.filter((i) => hasPermission(user.roles, i.permission)).map((i) => ({ href: i.href, label: i.label, icon: i.icon, exact: "exact" in i ? i.exact : undefined }));
  return (
    <DashboardShell title={t("title")} items={items}>
      {children}
    </DashboardShell>
  );
}
