"use client";
import { useTransition } from "react";
import { Loader2, UserRoundSearch } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestIdentityAction } from "@/app/[locale]/employer/actions";

/** Asks the candidate to lift their anonymity. No message to write: one click, the candidate decides. */
export function IdentityRequestButton({ applicationId }: { applicationId: string }) {
  const t = useTranslations("anonymity");
  const locale = useLocale();
  const [pending, start] = useTransition();
  return (
    <Button
      // The label may wrap in the narrow side column instead of overflowing.
      className="mt-1 h-auto min-h-10 w-full py-2 text-center leading-snug whitespace-normal"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await requestIdentityAction(locale, applicationId);
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <UserRoundSearch aria-hidden />}
      {t("recruiter.request")}
    </Button>
  );
}
