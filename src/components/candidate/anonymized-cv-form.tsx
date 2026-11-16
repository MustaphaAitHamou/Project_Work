"use client";
import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { ActionForm } from "@/components/forms/action-form";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { regenerateAnonymizedCvAction, saveAnonymizedCvAction } from "@/app/[locale]/candidate/actions";
import type { AnonymizedStatus } from "./resume-manager";

export function AnonymizedCvForm({ versionId, initialText, status }: { versionId: string; initialText: string; status: AnonymizedStatus }) {
  const t = useTranslations("anonymity");
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [regenerating, startRegenerate] = useTransition();
  const [state, action] = useActionState(async (prev: ActionState<{ text: string }>, formData: FormData) => {
    const result = await saveAnonymizedCvAction(prev, formData);
    // Show what was actually saved (personal data found again is masked in the field too).
    if (result.data) setText(result.data.text);
    return result;
  }, initialActionState as ActionState<{ text: string }>);
  return (
    <div className="space-y-4">
      {status === "unavailable" && <p className="text-sm">{t("cv.unreadable")}</p>}
      <ActionForm action={action} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="versionId" value={versionId} />
        <FormMessage state={state} />
        <div className="space-y-1.5">
          <label htmlFor="anonymized-text" className="text-sm font-medium">
            {t("cv.textLabel")}
          </label>
          <Textarea
            id="anonymized-text"
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={30000}
            rows={22}
            aria-describedby="anonymized-text-hint"
            className="text-sm leading-relaxed"
          />
          <p id="anonymized-text-hint" className="text-xs text-muted-foreground">
            {t("cv.textHint")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SubmitButton pendingLabel={t("cv.approve")}>
            <CheckCircle2 aria-hidden />
            {t("cv.approve")}
          </SubmitButton>
          <Button
            type="button"
            variant="outline"
            disabled={regenerating}
            onClick={() =>
              startRegenerate(async () => {
                const r = await regenerateAnonymizedCvAction(locale, versionId);
                if (r.ok) toast.success(r.message);
                else toast.error(r.message);
                router.refresh();
              })
            }
          >
            {regenerating ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            {t("cv.regenerate")}
          </Button>
        </div>
      </ActionForm>
    </div>
  );
}
