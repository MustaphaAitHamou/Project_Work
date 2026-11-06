"use client";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Check, Star, X, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { setApplicationStatusAction, updateApplicationMetaAction } from "@/app/[locale]/employer/actions";
import { cn } from "@/lib/utils";

export function ApplicationControls({ applicationId, status, rating, archived }: { applicationId: string; status: string; rating: number | null; archived: boolean }) {
  const t = useTranslations("employer.applications");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [currentRating, setRating] = useState(rating);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      router.refresh();
    });
  const actionable = !["withdrawn"].includes(status);
  return (
    <div className="space-y-4">
      {actionable && (
        <div className="flex flex-wrap gap-2">
          <Button variant={status === "shortlisted" ? "default" : "outline"} disabled={pending || status === "shortlisted"} onClick={() => run(() => setApplicationStatusAction(locale, applicationId, "shortlisted"))}>
            <Check aria-hidden />
            {t("shortlist")}
          </Button>
          <Button variant={status === "hired" ? "default" : "outline"} disabled={pending || status === "hired"} onClick={() => run(() => setApplicationStatusAction(locale, applicationId, "hired"))}>
            <Trophy aria-hidden />
            {t("hire")}
          </Button>
          <Button variant={status === "rejected" ? "destructive" : "outline"} disabled={pending || status === "rejected"} onClick={() => run(() => setApplicationStatusAction(locale, applicationId, "rejected"))}>
            <X aria-hidden />
            {t("reject")}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label={t("rating")} className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={currentRating === n}
              aria-label={t("ratingLabel", { rating: n })}
              disabled={pending}
              className="rounded p-0.5 hover:bg-muted"
              onClick={() => {
                const next = currentRating === n ? null : n;
                setRating(next);
                run(() => updateApplicationMetaAction(locale, applicationId, { rating: next }));
              }}
            >
              <Star className={cn("size-5", currentRating && n <= currentRating ? "fill-brand-warm text-brand-warm" : "text-muted-foreground")} aria-hidden />
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => updateApplicationMetaAction(locale, applicationId, { archived: !archived }))}>
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? t("unarchive") : t("archive")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("privateNotes")}</p>
    </div>
  );
}
