import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "../(auth)/auth-card";
import { EnrollPanel, VerifyForm } from "./mfa-forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminSecurity" });
  return { title: t("title"), robots: { index: false } };
}

/** Second factor (authenticator app) for back-office members: enrolment, then a code at each sign-in. */
export default async function AdminSecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/admin`);
  if (user.roles.length === 0) redirect(`/${locale}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_mfa_status");
  const status = data as { required?: boolean; aal?: string } | null;
  if (!status?.required || status.aal === "aal2") redirect(`/${locale}/admin`);
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.[0] ?? null;
  const t = await getTranslations("adminSecurity");
  return (
    <AuthCard title={t("title")} description={verified ? t("verifyText") : t("enrollText")} footer={t("lostDevice")}>
      {verified ? <VerifyForm factorId={verified.id} /> : <EnrollPanel />}
    </AuthCard>
  );
}
