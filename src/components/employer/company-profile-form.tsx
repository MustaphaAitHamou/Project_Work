"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState, useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { COMPANY_SIZES } from "@/lib/domain";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { CompanyAvatar } from "@/components/companies/company-avatar";
import { updateCompanyProfileAction } from "@/app/[locale]/employer/actions";

export function CompanyProfileForm({
  company,
  industries,
  canEdit,
}: {
  company: { id: string; legal_name: string; display_name: string | null; description: string | null; website: string | null; industry: string; size_range: string | null; logo_path: string | null };
  industries: string[];
  canEdit: boolean;
}) {
  const t = useTranslations("employer.company");
  const ti = useTranslations("industries");
  const locale = useLocale();
  const router = useRouter();
  const [state, action] = useActionState(updateCompanyProfileAction, initialActionState);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/company-logo", { method: "POST", body: fd });
      if (!res.ok) toast.error(t("logoFailed"));
      else {
        toast.success(t("logoUpdated"));
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("publicProfileTitle")}</CardTitle>
        <CardDescription>{t("publicProfileHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <CompanyAvatar name={company.display_name ?? company.legal_name} logoPath={company.logo_path} className="size-16" />
          {canEdit && (
            <>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={t("logo")} onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp aria-hidden />}
                {t("changeLogo")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
            </>
          )}
        </div>
        <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="companyId" value={company.id} />
          <div className="sm:col-span-2">
            <FormMessage state={state} toastOnSuccess />
          </div>
          <FormField id="displayName" label={t("displayName")} hint={t("displayNameHint")}>
            {(p) => <Input {...p} name="displayName" defaultValue={company.display_name ?? ""} maxLength={200} disabled={!canEdit} />}
          </FormField>
          <FormField id="industry" label={t("industry")}>
            {(p) => (
              <NativeSelect {...p} name="industry" defaultValue={company.industry} disabled={!canEdit}>
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {ti(i as never)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="website" label={t("website")}>
            {(p) => <Input {...p} name="website" type="url" defaultValue={company.website ?? ""} maxLength={200} disabled={!canEdit} />}
          </FormField>
          <FormField id="sizeRange" label={t("size")}>
            {(p) => (
              <NativeSelect {...p} name="sizeRange" defaultValue={company.size_range ?? ""} disabled={!canEdit}>
                <option value="">{t("choose")}</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {t("employees", { range: s })}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="description" label={t("description")} hint={t("descriptionHint")} className="sm:col-span-2">
            {(p) => <Textarea {...p} name="description" defaultValue={company.description ?? ""} maxLength={5000} rows={6} disabled={!canEdit} />}
          </FormField>
          {canEdit && (
            <div className="sm:col-span-2">
              <SubmitButton>{t("saveProfile")}</SubmitButton>
            </div>
          )}
        </ActionForm>
      </CardContent>
    </Card>
  );
}
