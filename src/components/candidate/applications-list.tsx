"use client";
import { useState, useTransition } from "react";
import { ChevronDown, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { APPLICATION_STATUS_VARIANT, type ApplicationStatus } from "@/lib/domain";
import { formatDate, formatDateTime, jobPath } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withdrawApplicationAction } from "@/app/[locale]/candidate/actions";

export interface CandidateApplication {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  status_changed_at: string;
  job: { title: string; slug: string; public_id: string; status: string } | null;
  jobTitle: string;
  company: string;
  history: { to_status: ApplicationStatus; created_at: string }[];
}

export function ApplicationsList({ items }: { items: CandidateApplication[] }) {
  const t = useTranslations("candidate.applications");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">{t("empty")}</p>
        <Button asChild className="mt-4">
          <Link href="/jobs">{t("findJobs")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {a.job ? (
                  <Link href={jobPath(a.job.slug, a.job.public_id)} className="font-semibold hover:text-primary">
                    {a.job.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{a.jobTitle || t("unavailableJob")}</span>
                )}
                <p className="text-sm text-muted-foreground">
                  {a.company} · {t("appliedOn", { date: formatDate(a.created_at, locale) })}
                </p>
              </div>
              <Badge variant={APPLICATION_STATUS_VARIANT[a.status]}>{te(`applicationStatus.${a.status}`)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                <ChevronDown className={open === a.id ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
                {t("history")}
              </Button>
              {["submitted", "viewed", "shortlisted"].includes(a.status) && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirm(a.id)}>
                  <Undo2 aria-hidden />
                  {t("withdraw")}
                </Button>
              )}
            </div>
            {open === a.id && (
              <ol className="mt-2 space-y-1 border-s ps-4 text-sm">
                {a.history.map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">{te(`applicationStatus.${h.to_status}`)}</span>{" "}
                    <span className="text-muted-foreground">· {formatDateTime(h.created_at, locale)}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("withdrawTitle")}</DialogTitle>
            <DialogDescription>{t("withdrawText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const id = confirm!;
                  setConfirm(null);
                  const r = await withdrawApplicationAction(locale, id);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                })
              }
            >
              {t("withdraw")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
