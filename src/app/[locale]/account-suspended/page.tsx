import { getTranslations, setRequestLocale } from "next-intl/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function AccountSuspendedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <div className="container-page max-w-xl py-16">
      <Alert variant="destructive">
        <AlertTitle>{t("suspendedTitle")}</AlertTitle>
        <AlertDescription>{t("suspendedText")}</AlertDescription>
      </Alert>
      <form action="/auth/signout" method="post" className="mt-6">
        <button type="submit" className="text-sm text-primary underline">
          {t("signOut")}
        </button>
      </form>
    </div>
  );
}
