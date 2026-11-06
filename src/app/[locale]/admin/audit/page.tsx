import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function AdminAuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "audit.view");
  const t = await getTranslations("admin.audit");
  const supabase = await createClient();
  const [{ data: logs }, { data: access }] = await Promise.all([
    supabase.from("admin_audit_logs").select("*, users(email)").order("created_at", { ascending: false }).limit(200),
    supabase.from("data_access_logs").select("*, users(email)").order("created_at", { ascending: false }).limit(200),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("adminActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>{t("colDate")}</TH>
                <TH>{t("colActor")}</TH>
                <TH>{t("colAction")}</TH>
                <TH>{t("colTarget")}</TH>
                <TH>{t("colDetails")}</TH>
              </TR>
            </THead>
            <TBody>
              {(logs ?? []).map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(l.created_at, locale)}</TD>
                  <TD>{(l.users as unknown as { email: string } | null)?.email ?? (l.actor_id ? <span className="font-mono text-xs">{l.actor_id.slice(0, 8)}</span> : t("system"))}</TD>
                  <TD className="font-mono text-xs">{l.action}</TD>
                  <TD className="font-mono text-xs">
                    {l.target_type}:{l.target_id?.slice(0, 8)}
                  </TD>
                  <TD className="max-w-xs truncate font-mono text-xs" title={JSON.stringify(l.details)}>
                    {JSON.stringify(l.details)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("dataAccess")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>{t("colDate")}</TH>
                <TH>{t("colActor")}</TH>
                <TH>{t("colAction")}</TH>
                <TH>{t("colTarget")}</TH>
              </TR>
            </THead>
            <TBody>
              {(access ?? []).map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(l.created_at, locale)}</TD>
                  <TD>
                    {(l.users as unknown as { email: string } | null)?.email ?? (l.actor_id ? l.actor_id.slice(0, 8) : "—")} <span className="text-xs text-muted-foreground">({l.actor_kind})</span>
                  </TD>
                  <TD className="font-mono text-xs">{l.action}</TD>
                  <TD className="font-mono text-xs">
                    {l.resource_type}:{l.resource_id.slice(0, 8)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
