import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdminForm } from "@/components/admin/admin-form";
import { updateComplianceItemAction, updateCountryAction } from "../../actions";

export default async function AdminCountryPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  if (!/^[A-Z]{2}$/.test(code)) notFound();
  await requirePermission(locale, "countries.manage");
  const [t, te, countryName] = await Promise.all([getTranslations("admin.countries"), getTranslations("enums"), getCountryNamer()]);
  const supabase = await createClient();
  const [{ data: c }, { data: items }] = await Promise.all([
    supabase.from("countries").select("*").eq("code", code).maybeSingle(),
    supabase.from("country_compliance_items").select("*").eq("country_code", code).order("is_blocking", { ascending: false }).order("item_key"),
  ]);
  if (!c) notFound();
  const open = (items ?? []).filter((i) => i.is_blocking && !["done", "not_applicable"].includes(i.status)).length;
  return (
    <div className="space-y-6">
      <PageHeader title={countryName(code)} description={t("detailDescription")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsTitle")}</CardTitle>
          <CardDescription>{open > 0 ? t("openBlocking", { count: open }) : t("allBlockingDone")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminForm action={updateCountryAction} hidden={{ code }} submitLabel={t("saveSettings")}>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["is_browsable", "is_registration_open", "is_paid_publishing_enabled", "auto_verification_enabled"] as const).map((k) => (
                <label key={k} className="flex items-start gap-2 text-sm">
                  <Checkbox name={k} defaultChecked={c[k]} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{t(`flags.${k}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`flagHints.${k}`)}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("complianceStatus")}</span>
                <NativeSelect name="compliance_status" defaultValue={c.compliance_status}>
                  {["review_required", "in_progress", "validated", "blocked"].map((s) => (
                    <option key={s} value={s}>
                      {te(`complianceStatus.${s}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">{t("notes")}</span>
                <Textarea name="compliance_notes" defaultValue={c.compliance_notes ?? ""} rows={3} />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">{t("override")}</span>
                <Textarea name="override" rows={2} placeholder={t("overridePlaceholder")} />
                <span className="text-xs text-muted-foreground">{t("overrideHint")}</span>
              </label>
            </div>
          </AdminForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("checklistTitle")}</CardTitle>
          <CardDescription>{t("checklistHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {(items ?? []).map((i) => (
              <li key={i.id} className="rounded-lg border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="font-medium">{t(`items.${i.item_key}` as never)}</p>
                  {i.is_blocking && <Badge variant="outline">{t("blocking")}</Badge>}
                  <Badge variant={i.status === "done" || i.status === "not_applicable" ? "success" : "warning"}>{te(`complianceItemStatus.${i.status}`)}</Badge>
                  {i.updated_at && <span className="text-xs text-muted-foreground">{formatDate(i.updated_at, locale)}</span>}
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{t(`itemHints.${i.item_key}` as never)}</p>
                <AdminForm action={updateComplianceItemAction} hidden={{ itemId: i.id }} submitLabel={t("saveItem")} size="sm" className="grid gap-2 sm:grid-cols-[180px_1fr_1fr_auto] sm:items-end">
                  <NativeSelect name="status" defaultValue={i.status} aria-label={t("itemStatus")} selectClassName="h-9">
                    {["todo", "in_progress", "done", "not_applicable"].map((s) => (
                      <option key={s} value={s}>
                        {te(`complianceItemStatus.${s}` as never)}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input name="notes" defaultValue={i.notes ?? ""} placeholder={t("itemNotes")} aria-label={t("itemNotes")} className="h-9" />
                  <Input name="evidenceUrl" type="url" defaultValue={i.evidence_url ?? ""} placeholder={t("evidence")} aria-label={t("evidence")} className="h-9" />
                </AdminForm>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
