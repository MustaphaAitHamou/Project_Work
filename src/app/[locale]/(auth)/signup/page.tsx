import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthCard } from "../auth-card";
import { SignupForm } from "./signup-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signupCandidateTitle") };
}

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("signupCandidateTitle")}
      description={t("signupCandidateDescription")}
      footer={
        <span>
          {t("alreadyAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>{" "}
          · {t("areYouRecruiter")}{" "}
          <Link href="/signup/employer" className="font-medium text-primary hover:underline">
            {t("createEmployer")}
          </Link>
        </span>
      }
    >
      <SignupForm accountType="candidate" />
    </AuthCard>
  );
}
