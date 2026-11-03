"use client";
import { useTransition } from "react";
import { BellPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { SearchParams } from "@/lib/search/params";
import { createAlertFromSearchAction } from "@/app/[locale]/candidate/alert-actions";

export function CreateAlertButton({ criteria, loggedInCandidate, loginHref }: { criteria: SearchParams; loggedInCandidate: boolean; loginHref: string }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [pending, start] = useTransition();
  if (!loggedInCandidate) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href={loginHref}>
          <BellPlus aria-hidden />
          {t("createAlert")}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createAlertFromSearchAction(locale, criteria);
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        })
      }
    >
      <BellPlus aria-hidden />
      {t("createAlert")}
    </Button>
  );
}
