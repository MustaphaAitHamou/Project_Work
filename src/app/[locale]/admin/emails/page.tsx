import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_TEMPLATES, buildEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { AdminForm } from "@/components/admin/admin-form";
import { deleteEmailTemplateAction, upsertEmailTemplateAction } from "../actions";

const SAMPLE = { job_title: "Comptable", company_name: "ACME", status: "shortlisted", outcome: "verified", decision: "approve", alert_name: "Comptable Lyon", jobs: [], grace_days: 3, type: "export", suspended: true, reason: "Annonce non conforme" };

export default async function AdminEmailsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ template?: string; lang?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "emails.manage");
  const sp = await searchParams;
  const template = (EMAIL_TEMPLATES as readonly string[]).includes(sp.template ?? "") ? (sp.template as (typeof EMAIL_TEMPLATES)[number]) : EMAIL_TEMPLATES[0];
  const lang = ["fr", "en", "es", "ar"].includes(sp.lang ?? "") ? sp.lang! : locale;
  const t = await getTranslations("admin.emails");
  const supabase = await createClient();
  const { data: overrides } = await supabase.from("email_templates").select("*");
  const current = (overrides ?? []).find((o) => o.template === template && o.locale === lang);
  const preview = buildEmail(template, lang, SAMPLE, { siteUrl: env().NEXT_PUBLIC_SITE_URL, firstName: "Lina", override: current?.is_active ? { subject: current.subject, body: current.body } : null });
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <NativeSelect name="template" defaultValue={template} className="w-72" aria-label={t("template")}>
          {EMAIL_TEMPLATES.map((tpl) => (
            <option key={tpl} value={tpl}>
              {tpl}
              {(overrides ?? []).some((o) => o.template === tpl) ? " •" : ""}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="lang" defaultValue={lang} className="w-28" aria-label={t("language")}>
          {["fr", "en", "es", "ar"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          {t("open")}
        </Button>
      </form>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("override")} {current ? <Badge variant={current.is_active ? "success" : "muted"}>{current.is_active ? t("active") : t("inactive")}</Badge> : <Badge variant="muted">{t("default")}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AdminForm action={upsertEmailTemplateAction} hidden={{ template, templateLocale: lang }} submitLabel={t("save")}>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{t("subject")}</span>
                <Input name="subject" defaultValue={current?.subject ?? preview.subject} maxLength={200} required />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{t("body")}</span>
                <Textarea name="body" rows={10} defaultValue={current?.body ?? ""} placeholder={t("bodyPlaceholder")} required />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="isActive" defaultChecked={current?.is_active ?? true} />
                {t("enable")}
              </label>
              <p className="text-xs text-muted-foreground">{t("placeholders")}</p>
            </AdminForm>
            {current && <AdminForm action={deleteEmailTemplateAction} hidden={{ template, templateLocale: lang }} submitLabel={t("restoreDefault")} variant="ghost" size="sm" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("preview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm font-medium">{preview.subject}</p>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs" dir={lang === "ar" ? "rtl" : "ltr"}>
              {preview.text}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
