import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/security/request";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("loginTitle"), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = safeNextPath(sp.next, locale) ?? undefined;
  const user = await getSessionUser();
  if (user) redirect(next ?? `/${locale}/${user.accountType === "employer" ? "employer" : "candidate"}`);
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("loginTitle")}
      description={t("loginDescription")}
      footer={
        <span>
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t("createCandidate")}
          </Link>{" "}
          ·{" "}
          <Link href="/signup/employer" className="font-medium text-primary hover:underline">
            {t("createEmployer")}
          </Link>
        </span>
      }
    >
      {sp.error === "link_invalid" && (
        <Alert variant="destructive">
          <AlertDescription>{t("linkExpired")}</AlertDescription>
        </Alert>
      )}
      <LoginForm next={next} />
    </AuthCard>
  );
}
