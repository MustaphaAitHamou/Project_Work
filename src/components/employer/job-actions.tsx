"use client";
import { useState, useTransition } from "react";
import { Ban, CreditCard, Eye, Inbox, RotateCcw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { closeJobAction, deleteDraftAction, reopenJobAction } from "@/app/[locale]/employer/actions";
import type { JobStatus } from "@/lib/domain";

export function JobActions({
  jobId,
  status,
  canReopen,
  paidThroughLabel,
  publicHref,
  applicationsCount,
}: {
  jobId: string;
  status: JobStatus;
  canReopen: boolean;
  paidThroughLabel: string | null;
  publicHref: string | null;
  applicationsCount: number;
}) {
  const t = useTranslations("employer.jobs");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        after?.();
      } else toast.error(r.message);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending_payment" && (
        <Button asChild>
          <Link href={`/employer/checkout/${jobId}`}>
            <CreditCard aria-hidden />
            {t("payAndPublish")}
          </Link>
        </Button>
      )}
      <Button asChild variant="outline">
        <Link href={`/employer/jobs/${jobId}/applications`}>
          <Inbox aria-hidden />
          {t("applicationsCount", { count: applicationsCount })}
        </Link>
      </Button>
      {publicHref ? (
        <Button asChild variant="outline">
          <Link href={publicHref}>
            <Eye aria-hidden />
            {t("viewPublic")}
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link href={`/employer/jobs/${jobId}/preview`}>
            <Eye aria-hidden />
            {t("preview")}
          </Link>
        </Button>
      )}
      {["active", "pending_payment", "in_review", "suspended", "expired", "rejected"].includes(status) && (
        <Button variant="outline" className="text-destructive" disabled={pending} onClick={() => setConfirmClose(true)}>
          <Ban aria-hidden />
          {t("close")}
        </Button>
      )}
      {status === "closed" && canReopen && (
        <Button variant="outline" disabled={pending} onClick={() => run(() => reopenJobAction(locale, jobId))}>
          <RotateCcw aria-hidden />
          {t("reopen")}
        </Button>
      )}
      {["draft", "rejected"].includes(status) && (
        <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => deleteDraftAction(locale, jobId), () => router.push("/employer/jobs"))}>
          <Trash2 aria-hidden />
          {tc("delete")}
        </Button>
      )}
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("closeTitle")}</DialogTitle>
            <DialogDescription>{paidThroughLabel ? t("closeTextPaid", { date: paidThroughLabel }) : t("closeText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmClose(false);
                run(() => closeJobAction(locale, jobId));
              }}
            >
              {t("confirmClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
