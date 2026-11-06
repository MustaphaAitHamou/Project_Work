"use client";
import { useRef, useState, useTransition } from "react";
import { FileUp, Loader2, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rerunVerificationAction } from "@/app/[locale]/employer/actions";

export function VerificationPanel({
  companyId,
  canRerun,
  canUpload,
  documents,
}: {
  companyId: string;
  canRerun: boolean;
  canUpload: boolean;
  documents: { id: string; doc_type: string; original_filename: string; created_at: string }[];
}) {
  const t = useTranslations("employer.verification");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [docType, setDocType] = useState("registry_extract");
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("docType", docType);
      const res = await fetch("/api/verification-documents", { method: "POST", body: fd });
      if (res.ok) {
        toast.success(t("uploaded"));
        router.refresh();
      } else toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="space-y-6">
      {canRerun && (
        <Card>
          <CardHeader>
            <CardTitle>{t("rerunTitle")}</CardTitle>
            <CardDescription>{t("rerunText")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await rerunVerificationAction(locale, companyId);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              {t("rerun")}
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("documentsTitle")}</CardTitle>
          <CardDescription>{t("documentsText")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canUpload && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("docType")}</span>
                <NativeSelect value={docType} onChange={(e) => setDocType(e.target.value)} className="w-64">
                  {["registry_extract", "authority_proof", "other"].map((d) => (
                    <option key={d} value={d}>
                      {t(`docTypes.${d}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" aria-label={t("upload")} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button type="button" disabled={uploading} onClick={() => input.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
                {t("upload")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("documentsPolicy")}</p>
          {documents.length > 0 && (
            <ul className="divide-y rounded-lg border text-sm">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 p-3">
                  <span>
                    <span className="font-medium">{t(`docTypes.${d.doc_type}` as never)}</span> · {d.original_filename}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(d.created_at, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
