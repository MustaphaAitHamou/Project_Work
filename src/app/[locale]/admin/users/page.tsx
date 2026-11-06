import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, ADMIN_ROLES } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { AdminForm } from "@/components/admin/admin-form";
import { setRoleAction, setUserStatusAction } from "../actions";

export default async function AdminUsersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requirePermission(locale, "users.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const [t, te] = await Promise.all([getTranslations("admin.users"), getTranslations("enums")]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_search_users", { p_query: q, p_limit: 50 });
  const canSuspend = hasPermission(me.roles, "users.suspend");
  const canRoles = hasPermission(me.roles, "roles.manage");
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      <form method="get" className="flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder={t("search")} aria-label={t("search")} className="max-w-sm" />
        <Button type="submit" variant="outline">
          {t("searchButton")}
        </Button>
      </form>
      <ul className="space-y-3">
        {(data ?? []).map((u) => (
          <li key={u.id}>
            <Card>
              <CardContent className="grid gap-4 pt-5 lg:grid-cols-[1fr_auto]">
                <div className="space-y-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {u.first_name} {u.last_name}
                    <Badge variant="outline">{t(`types.${u.account_type}`)}</Badge>
                    <Badge variant={u.status === "active" ? "success" : "destructive"}>{t(`statuses.${u.status}`)}</Badge>
                    {u.roles.map((r) => (
                      <Badge key={r} variant="secondary">
                        {te(`adminRole.${r}` as never)}
                      </Badge>
                    ))}
                  </p>
                  <p className="text-muted-foreground">
                    {u.email} {u.company_name ? `· ${u.company_name}` : ""} · {t("since", { date: formatDate(u.created_at, locale) })}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  {canSuspend && u.id !== me.id && u.status !== "deleted" && (
                    <AdminForm action={setUserStatusAction} hidden={{ userId: u.id, status: u.status === "active" ? "suspended" : "active" }} submitLabel={u.status === "active" ? t("suspend") : t("reactivate")} variant={u.status === "active" ? "destructive" : "outline"} size="sm" className="flex items-end gap-2">
                      <Input name="reason" placeholder={t("reason")} aria-label={t("reason")} required className="h-8 w-48" />
                    </AdminForm>
                  )}
                  {canRoles && u.status === "active" && (
                    <AdminForm action={setRoleAction} hidden={{ userId: u.id }} submitLabel={t("applyRole")} size="sm" className="flex items-end gap-2">
                      <NativeSelect name="role" aria-label={t("role")} className="w-52" selectClassName="h-8">
                        {ADMIN_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {te(`adminRole.${r}`)}
                          </option>
                        ))}
                      </NativeSelect>
                      <NativeSelect name="grant" aria-label={t("operation")} className="w-32" selectClassName="h-8">
                        <option value="true">{t("grant")}</option>
                        <option value="false">{t("revoke")}</option>
                      </NativeSelect>
                    </AdminForm>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
