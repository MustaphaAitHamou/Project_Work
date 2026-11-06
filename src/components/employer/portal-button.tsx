"use client";
import { useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openPortalAction } from "@/app/[locale]/employer/billing-actions";

export function PortalButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await openPortalAction(locale);
          if (r && !r.ok) toast.error(r.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
      {t("portal")}
    </Button>
  );
}
