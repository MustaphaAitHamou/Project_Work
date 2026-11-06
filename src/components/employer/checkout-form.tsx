"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { initialActionState } from "@/lib/action-state";
import { Checkbox } from "@/components/ui/checkbox";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { startCheckoutAction } from "@/app/[locale]/employer/billing-actions";

export function CheckoutForm({ jobId, disabled }: { jobId: string; disabled: boolean }) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [state, action] = useActionState(startCheckoutAction, initialActionState);
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="jobId" value={jobId} />
      <FormMessage state={state} />
      <label className="flex items-start gap-2 text-sm">
        <Checkbox name="acceptTerms" className="mt-0.5" required />
        <span>
          {t.rich("acceptTerms", {
            terms: (c) => (
              <Link href="/legal/employer-terms" className="text-primary underline" target="_blank">
                {c}
              </Link>
            ),
          })}
        </span>
      </label>
      <SubmitButton size="lg" className="w-full" disabled={disabled} pendingLabel={t("redirecting")}>
        <Lock aria-hidden />
        {t("payButton")}
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">{t("securedByStripe")}</p>
    </ActionForm>
  );
}
