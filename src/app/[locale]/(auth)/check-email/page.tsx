import { MailCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "../auth-card";
import { ResendForm } from "./resend-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("checkEmailTitle"), robots: { index: false } };
}

export default async function CheckEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("checkEmailTitle")}>
      <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm">{t("checkEmailText")}</p>
      </div>
      <ResendForm />
    </AuthCard>
  );
}
