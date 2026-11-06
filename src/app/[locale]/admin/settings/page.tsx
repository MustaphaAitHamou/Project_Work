import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AdminForm } from "@/components/admin/admin-form";
import { ServiceClientForm } from "@/components/admin/service-client-form";
import { createServiceClientAction, revokeServiceClientAction, updateSettingAction } from "../actions";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requirePermission(locale, "settings.manage");
  const t = await getTranslations("admin.settings");
  const supabase = await createClient();
  const canClients = hasPermission(me.roles, "service_clients.manage");
  const [{ data: settings }, { data: clients }] = await Promise.all([
    supabase.from("platform_settings").select("*").order("key"),
    canClients ? supabase.from("service_api_clients").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] as never[] }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("platform")}</CardTitle>
          <CardDescription>{t("platformHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {(settings ?? []).map((s) => (
              <li key={s.key} className="py-4 first:pt-0 last:pb-0">
                <AdminForm action={updateSettingAction} hidden={{ key: s.key }} submitLabel={t("save")} size="sm" variant="outline" className="grid gap-2 md:grid-cols-[1fr_260px_auto] md:items-start">
                  <div className="text-sm">
                    <p className="font-mono text-xs font-medium">{s.key}</p>
                    <p className="text-muted-foreground">{s.description}</p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={s.is_public ? "outline" : "muted"}>{s.is_public ? t("public") : t("private")}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(s.updated_at, locale)}</span>
                    </p>
                  </div>
                  <Textarea name="value" rows={1} defaultValue={JSON.stringify(s.value)} aria-label={s.key} className="min-h-9 font-mono text-xs" dir="ltr" />
                </AdminForm>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {canClients && (
        <Card>
          <CardHeader>
            <CardTitle>{t("clients")}</CardTitle>
            <CardDescription>{t("clientsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ServiceClientForm action={createServiceClientAction} />
            <Table>
              <THead>
                <TR>
                  <TH>{t("clientName")}</TH>
                  <TH>{t("prefix")}</TH>
                  <TH>{t("allowedIps")}</TH>
                  <TH>{t("lastUsed")}</TH>
                  <TH>{t("state")}</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {(clients ?? []).map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD className="font-mono text-xs" dir="ltr">
                      {c.token_prefix}…
                    </TD>
                    <TD className="font-mono text-xs" dir="ltr">
                      {c.allowed_ips.length ? c.allowed_ips.join(", ") : t("anyIp")}
                    </TD>
                    <TD className="text-muted-foreground">{c.last_used_at ? formatDateTime(c.last_used_at, locale) : t("never")}</TD>
                    <TD>{c.revoked_at ? <Badge variant="muted">{t("revoked")}</Badge> : <Badge variant="success">{t("activeClient")}</Badge>}</TD>
                    <TD>
                      {!c.revoked_at && <AdminForm action={revokeServiceClientAction} hidden={{ clientId: c.id }} submitLabel={t("revoke")} variant="destructive" size="sm" confirmText={t("revokeConfirm")} />}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
