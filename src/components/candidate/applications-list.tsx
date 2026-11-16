"use client";
import { useState, useTransition } from "react";
import { ChevronDown, EyeOff, ShieldCheck, Undo2, UserRoundSearch } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { APPLICATION_STATUS_VARIANT, type ApplicationStatus } from "@/lib/domain";
import { formatDate, formatDateTime, jobPath } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { answerIdentityRequestAction, revokeIdentityAccessAction, withdrawApplicationAction } from "@/app/[locale]/candidate/actions";

export interface RevealRow {
  status: "pending" | "accepted" | "refused" | "revoked" | "expired";
  origin: "recruiter_request" | "legacy_consent";
  requested_at: string;
  expires_at: string;
  responded_at: string | null;
  revoked_at: string | null;
}

export interface CandidateApplication {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  status_changed_at: string;
  job: { title: string; slug: string; public_id: string; status: string } | null;
  jobTitle: string;
  company: string;
  history: { to_status: ApplicationStatus; created_at: string }[];
  /** Alias under which the recruiter sees the application. */
  alias: string;
  reveal: RevealRow | null;
}

const OPEN_STATUSES: ApplicationStatus[] = ["submitted", "viewed", "shortlisted", "hired", "job_closed"];

/** What the recruiter knows about the candidate, and the candidate's choices. */
function IdentityPanel({ a, onAnswer, onRevoke, pending }: { a: CandidateApplication; onAnswer: (accept: boolean) => void; onRevoke: () => void; pending: boolean }) {
  const t = useTranslations("anonymity");
  const locale = useLocale();
  const r = a.reveal;
  const date = (v: string | null) => (v ? formatDate(v, locale) : "");
  if (r?.status === "pending" && OPEN_STATUSES.includes(a.status)) {
    return (
      <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-4" role="group" aria-labelledby={`reveal-${a.id}`}>
        <p id={`reveal-${a.id}`} className="flex items-center gap-2 font-semibold">
          <UserRoundSearch className="size-4 text-primary" aria-hidden />
          {t("candidate.requestTitle", { company: a.company })}
        </p>
        <p className="mt-1 text-sm">{t("candidate.requestText", { until: date(r.expires_at) })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => onAnswer(true)}>
            {t("candidate.accept")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onAnswer(false)}>
            {t("candidate.refuse")}
          </Button>
        </div>
      </div>
    );
  }
  const shared = r?.status === "accepted";
  let detail = t("candidate.aliasNotice", { alias: a.alias });
  if (shared) detail = r.origin === "legacy_consent" ? t("candidate.legacyShared") : t("candidate.acceptedOn", { date: date(r.responded_at) });
  else if (r?.status === "refused") detail = `${t("candidate.refusedOn", { date: date(r.responded_at) })} ${detail}`;
  else if (r?.status === "revoked") detail = `${t("candidate.revokedOn", { date: date(r.revoked_at) })} ${detail}`;
  else if (r?.status === "expired") detail = `${t("candidate.expired")} ${detail}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <Badge variant={shared ? "success" : "secondary"}>
        {shared ? <ShieldCheck aria-hidden /> : <EyeOff aria-hidden />}
        {shared ? t("revealedBadge") : t("anonymousBadge")}
      </Badge>
      <span className="text-muted-foreground">{detail}</span>
      {shared && a.status !== "withdrawn" && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={onRevoke}>
          {t("candidate.revoke")}
        </Button>
      )}
    </div>
  );
}

export function ApplicationsList({ items }: { items: CandidateApplication[] }) {
  const t = useTranslations("candidate.applications");
  const ta = useTranslations("anonymity");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
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
            <IdentityPanel
              a={a}
              pending={pending}
              onAnswer={(accept) => run(() => answerIdentityRequestAction(locale, a.id, accept))}
              onRevoke={() => setRevoking(a.id)}
            />
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
      <Dialog open={Boolean(revoking)} onOpenChange={(o) => !o && setRevoking(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{ta("candidate.revokeTitle")}</DialogTitle>
            <DialogDescription>{ta("candidate.revokeText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const id = revoking!;
                setRevoking(null);
                run(() => revokeIdentityAccessAction(locale, id));
              }}
            >
              {ta("candidate.revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
