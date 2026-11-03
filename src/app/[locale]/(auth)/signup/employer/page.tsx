import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthCard } from "../../auth-card";
import { SignupForm } from "../signup-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signupEmployerTitle") };
}

export default async function EmployerSignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("signupEmployerTitle")}
      description={t("signupEmployerDescription")}
      footer={
        <span>
          {t("alreadyAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>{" "}
          · {t("areYouCandidate")}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t("createCandidate")}
          </Link>
        </span>
      }
    >
      <SignupForm accountType="employer" />
    </AuthCard>
  );
}
