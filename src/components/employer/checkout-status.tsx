"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Waits for the webhook-driven activation (the success URL itself never activates anything). */
export function CheckoutStatus({ jobId, active }: { jobId: string | null; active: boolean }) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (active || tries >= 20) return;
    const id = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 2000);
    return () => clearTimeout(id);
  }, [active, tries, router]);
  if (active) {
    return (
      <div className="space-y-4 text-center" role="status">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <p className="text-lg font-semibold">{t("activeTitle")}</p>
        <p className="text-muted-foreground">{t("activeText")}</p>
        {jobId && (
          <Button asChild>
            <Link href={`/employer/jobs/${jobId}`}>{t("goToJob")}</Link>
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4 text-center" role="status" aria-live="polite">
      <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden />
      <p className="text-lg font-semibold">{t("pendingTitle")}</p>
      <p className="text-muted-foreground">{tries >= 20 ? t("pendingLong") : t("pendingText")}</p>
      {jobId && (
        <Button asChild variant="outline">
          <Link href={`/employer/jobs/${jobId}`}>{t("goToJob")}</Link>
        </Button>
      )}
    </div>
  );
}
