"use client";
import { useRef, useState, useTransition } from "react";
import { Download, FileText, Loader2, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteResumeAction, renameResumeAction, setPrimaryResumeAction } from "@/app/[locale]/candidate/actions";

export interface ResumeItem {
  id: string;
  label: string;
  is_primary: boolean;
  updated_at: string;
  current: { id: string; original_filename: string; size_bytes: number; created_at: string; mime_type: string } | null;
  sentVersions: number;
}

function UploadControl({ resumeId, label, maxBytes, onUploaded, variant = "default" }: { resumeId?: string; label: string; maxBytes: number; onUploaded: () => void; variant?: "default" | "outline" }) {
  const t = useTranslations("candidate.resumes");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (file.size > maxBytes) {
      toast.error(t("tooLarge", { mb: Math.round(maxBytes / 1024 / 1024) }));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (resumeId) fd.set("resumeId", resumeId);
      const res = await fetch("/api/resumes", { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string; reason?: string };
      if (!res.ok) {
        toast.error(json.error === "file_invalid" ? t(`reasons.${json.reason ?? "type_not_allowed"}` as never) : t("uploadFailed"));
        return;
      }
      toast.success(resumeId ? t("replaced") : t("uploaded"));
      onUploaded();
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <>
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <Button type="button" variant={variant} size={resumeId ? "sm" : "default"} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : resumeId ? <RefreshCw aria-hidden /> : <Upload aria-hidden />}
        {busy ? t("uploading") : label}
      </Button>
    </>
  );
}

export function ResumeManager({ items, maxBytes }: { items: ResumeItem[]; maxBytes: number }) {
  const t = useTranslations("candidate.resumes");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toDelete, setToDelete] = useState<ResumeItem | null>(null);
  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 p-5">
        <div>
          <p className="font-medium">{t("addTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("constraints", { mb: Math.round(maxBytes / 1024 / 1024) })}</p>
        </div>
        <UploadControl label={t("upload")} maxBytes={maxBytes} onUploaded={refresh} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-4 pt-5">
                  <FileText className="size-8 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`label-${r.id}`}>
                        {t("label")}
                      </label>
                      <Input
                        id={`label-${r.id}`}
                        defaultValue={r.label}
                        maxLength={100}
                        className="h-8 w-56 font-medium"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.label) run(() => renameResumeAction(locale, r.id, v));
                        }}
                      />
                      {r.is_primary && (
                        <Badge variant="success">
                          <Star aria-hidden />
                          {t("primary")}
                        </Badge>
                      )}
                    </div>
                    {r.current && (
                      <p className="text-xs text-muted-foreground">
                        {r.current.original_filename} · {(r.current.size_bytes / 1024).toFixed(0)} Ko · {formatDateTime(r.current.created_at, locale)}
                      </p>
                    )}
                    {r.sentVersions > 0 && <p className="text-xs text-muted-foreground">{t("sentVersions", { count: r.sentVersions })}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.current && (
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/api/resumes/versions/${r.current.id}/download`}>
                          <Download aria-hidden />
                          {tc("download")}
                        </a>
                      </Button>
                    )}
                    <UploadControl resumeId={r.id} label={t("replace")} maxBytes={maxBytes} onUploaded={refresh} variant="outline" />
                    {!r.is_primary && r.current && (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setPrimaryResumeAction(locale, r.id))}>
                        <Star aria-hidden />
                        {t("makePrimary")}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(r)}>
                      <Trash2 aria-hidden />
                      {tc("delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const r = toDelete;
                setToDelete(null);
                if (r) run(() => deleteResumeAction(locale, r.id));
              }}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
