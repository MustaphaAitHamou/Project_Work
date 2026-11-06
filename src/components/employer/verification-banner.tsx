import { getTranslations } from "next-intl/server";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { VerificationStatus } from "@/lib/domain";

export async function VerificationBanner({ status, message }: { status: VerificationStatus; message?: string | null }) {
  const t = await getTranslations("employer.verificationBanner");
  if (status === "verified") return null;
  const variant = status === "rejected" || status === "suspended" ? "destructive" : "warning";
  const Icon = status === "rejected" || status === "suspended" ? ShieldX : status === "manual_review" ? ShieldAlert : ShieldCheck;
  return (
    <Alert variant={variant}>
      <Icon aria-hidden />
      <AlertTitle>{t(`title_${status}`)}</AlertTitle>
      <AlertDescription>
        {message ? <p>{message}</p> : <p>{t(`text_${status}`)}</p>}
        <Link href="/employer/verification" className="mt-1 inline-block font-medium underline">
          {t("cta")}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
