"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, MousePointerClick, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyAction, consentAndApplyAction, type ApplyResult } from "@/app/[locale]/jobs/actions";

export type ApplyState =
  | { kind: "anonymous"; loginHref: string; signupHref: string }
  | { kind: "employer" }
  | { kind: "closed" }
  | { kind: "incomplete"; missing: string[] }
  | { kind: "consent"; consentVersion: string; transmitted: string[] }
  | { kind: "ready" }
  | { kind: "applied"; applicationId: string };

/**
 * "Postuler en 1 clic". The button is disabled while the request is in flight;
 * duplicates are also prevented in the database (unique constraint + lock).
 */
export function ApplyButton({ jobId, initial, jobTitle }: { jobId: string; initial: ApplyState; jobTitle: string }) {
  const t = useTranslations("apply");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, setState] = useState<ApplyState>(initial);
  const [pending, start] = useTransition();
  const [consentOpen, setConsentOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);

  const handle = (res: ApplyResult) => {
    if (res.ok && res.applicationId) {
      setState({ kind: "applied", applicationId: res.applicationId });
      setConsentOpen(false);
      toast.success(res.result === "already_applied" ? t("alreadyApplied") : t("success", { job: jobTitle }));
      return;
    }
    if (res.error === "profile_incomplete") {
      setState({ kind: "incomplete", missing: res.missing ?? [] });
      setMissingOpen(true);
      return;
    }
    if (res.error === "job_not_open") setState({ kind: "closed" });
    toast.error(res.message ?? tc("errorTitle"));
  };

  if (state.kind === "applied") {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 className="size-5" aria-hidden />
          {t("applied")}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/candidate/applications">{t("trackApplication")}</Link>
        </Button>
      </div>
    );
  }
  if (state.kind === "closed") {
    return (
      <Button disabled className="w-full" size="lg">
        {t("closed")}
      </Button>
    );
  }
  if (state.kind === "employer") {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full" size="lg">
          {t("cta")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("candidatesOnly")}</p>
      </div>
    );
  }
  if (state.kind === "anonymous") {
    return (
      <div className="space-y-2">
        <Button asChild className="w-full" size="lg">
          <Link href={state.loginHref}>
            <MousePointerClick aria-hidden />
            {t("cta")}
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href={state.signupHref} className="font-medium text-primary underline">
            {t("createAccount")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (state.kind === "incomplete") return setMissingOpen(true);
          if (state.kind === "consent") return setConsentOpen(true);
          start(async () => handle(await applyAction(jobId, locale)));
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <MousePointerClick aria-hidden />}
        {pending ? t("sending") : t("cta")}
      </Button>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" aria-hidden />
        {t("freeNoRedirect")}
      </p>

      <Dialog open={missingOpen} onOpenChange={setMissingOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("incompleteTitle")}</DialogTitle>
            <DialogDescription>{t("incompleteText")}</DialogDescription>
          </DialogHeader>
          {state.kind === "incomplete" && state.missing.length > 0 && (
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {state.missing.map((m) => (
                <li key={m}>{t(`missing.${m}` as never)}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button asChild variant="outline">
              <Link href="/candidate/resumes">{t("goToResumes")}</Link>
            </Button>
            <Button asChild>
              <Link href="/candidate/profile">{t("completeProfile")}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent closeLabel={tc("close")} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("consentTitle")}</DialogTitle>
            <DialogDescription>{t("consentIntro")}</DialogDescription>
          </DialogHeader>
          {state.kind === "consent" && (
            <ul className="grid gap-1.5 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2">
              {state.transmitted.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {t(`transmitted.${item}` as never)}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t("consentRecipients")}</p>
            <p>{t("consentNoPhoto")}</p>
            <p>
              {t("consentRights")}{" "}
              <Link href="/legal/privacy" className="text-primary underline" target="_blank">
                {t("privacyPolicy")}
              </Link>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                state.kind === "consent" && start(async () => handle(await consentAndApplyAction(jobId, state.consentVersion, locale)))
              }
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("consentConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
