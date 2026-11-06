import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminForm } from "@/components/admin/admin-form";
import { upsertModerationTermAction } from "../actions";

function TermFields({ term }: { term?: { id: string; code: string; category: string; language: string | null; pattern: string; description: string | null; is_active: boolean } }) {
  return (
    <>
      <Input name="code" defaultValue={term?.code ?? ""} placeholder="code" aria-label="code" required pattern="[a-z0-9_]{2,40}" className="h-9" />
      <NativeSelect name="category" defaultValue={term?.category ?? "discrimination"} aria-label="category" selectClassName="h-9">
        {["discrimination", "external_redirect", "scam", "other"].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect name="language" defaultValue={term?.language ?? ""} aria-label="language" selectClassName="h-9">
        <option value="">*</option>
        {["fr", "en", "es", "ar"].map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </NativeSelect>
      <Input name="pattern" defaultValue={term?.pattern ?? ""} placeholder="\\mregex\\M" aria-label="pattern" required className="h-9 font-mono" />
      <Input name="description" defaultValue={term?.description ?? ""} placeholder="description" aria-label="description" className="h-9" />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isActive" defaultChecked={term?.is_active ?? true} />
        on
      </label>
    </>
  );
}

export default async function AdminModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "moderation_terms.manage");
  const t = await getTranslations("admin.moderation");
  const supabase = await createClient();
  const { data } = await supabase.from("moderation_terms").select("*").order("language").order("code");
  const cls = "grid gap-2 lg:grid-cols-[140px_150px_70px_1.5fr_1fr_60px_auto] lg:items-center";
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("add")}</CardTitle>
          <CardDescription>{t("addHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminForm action={upsertModerationTermAction} submitLabel={t("save")} size="sm" className={cls}>
            <TermFields />
          </AdminForm>
        </CardContent>
      </Card>
      <ul className="space-y-2">
        {(data ?? []).map((term) => (
          <li key={term.id} className="rounded-lg border bg-card p-3">
            <AdminForm action={upsertModerationTermAction} hidden={{ termId: term.id }} submitLabel={t("save")} size="sm" variant="outline" className={cls}>
              <TermFields term={term} />
            </AdminForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
