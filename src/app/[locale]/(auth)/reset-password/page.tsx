import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "../auth-card";
import { ResetForm } from "./reset-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("resetTitle"), robots: { index: false } };
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const user = await getSessionUser();
  return (
    <AuthCard title={t("resetTitle")} description={t("resetDescription")}>
      {user ? (
        <ResetForm />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            {t("linkExpired")}{" "}
            <Link href="/forgot-password" className="underline">
              {t("requestNewLink")}
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </AuthCard>
  );
}
