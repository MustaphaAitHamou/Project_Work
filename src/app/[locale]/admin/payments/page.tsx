import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoneyMinor } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AdminForm } from "@/components/admin/admin-form";
import { refundAction } from "../actions";

export default async function AdminPaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requirePermission(locale, "payments.view");
  const canRefund = hasPermission(me.roles, "payments.refund");
  const t = await getTranslations("admin.payments");
  const supabase = await createClient();
  const [{ data: payments }, { data: events }, { data: refunds }] = await Promise.all([
    supabase.from("payments").select("*, companies(legal_name), jobs(title)").order("created_at", { ascending: false }).limit(100),
    supabase.from("stripe_events").select("id, type, received_at, processed_at, attempts, last_error").order("received_at", { ascending: false }).limit(50),
    supabase.from("refunds").select("*, companies(legal_name)").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("payments")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>{t("colDate")}</TH>
                <TH>{t("colCompany")}</TH>
                <TH>{t("colAmount")}</TH>
                <TH>{t("colStatus")}</TH>
                {canRefund && <TH>{t("colRefund")}</TH>}
              </TR>
            </THead>
            <TBody>
              {(payments ?? []).map((p) => (
                <TR key={p.id}>
                  <TD className="text-muted-foreground">{formatDateTime(p.created_at, locale)}</TD>
                  <TD>
                    {(p.companies as unknown as { legal_name: string } | null)?.legal_name}
                    <p className="text-xs text-muted-foreground">{(p.jobs as unknown as { title: string } | null)?.title}</p>
                  </TD>
                  <TD className="tabular-nums">
                    {formatMoneyMinor(p.amount, p.currency, locale)}
                    {p.amount_refunded > 0 && <p className="text-xs text-muted-foreground">{t("refundedAmount", { amount: formatMoneyMinor(p.amount_refunded, p.currency, locale) })}</p>}
                  </TD>
                  <TD>
                    <Badge variant={p.status === "succeeded" ? "success" : p.status === "failed" ? "destructive" : "muted"}>{t(`statuses.${p.status}` as never)}</Badge>
                    {p.failure_code && <p className="text-xs text-muted-foreground">{p.failure_code}</p>}
                  </TD>
                  {canRefund && (
                    <TD>
                      {["succeeded", "partially_refunded"].includes(p.status) && p.stripe_payment_intent_id && (
                        <AdminForm action={refundAction} hidden={{ paymentId: p.id }} submitLabel={t("refund")} size="sm" variant="outline" confirmText={t("refundConfirm")} className="flex flex-wrap items-end gap-2">
                          <Input name="amount" inputMode="decimal" placeholder={t("amountOptional")} aria-label={t("amountOptional")} className="h-8 w-28" />
                          <Input name="reason" placeholder={t("reason")} aria-label={t("reason")} className="h-8 w-56" required minLength={10} />
                        </AdminForm>
                      )}
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("refunds")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!refunds?.length ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {refunds.map((r) => (
                <li key={r.id}>
                  {formatDateTime(r.created_at, locale)} · {(r.companies as unknown as { legal_name: string } | null)?.legal_name} · {formatMoneyMinor(r.amount, r.currency, locale)} · {r.reason ?? "—"}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("events")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>{t("colReceived")}</TH>
                <TH>{t("colType")}</TH>
                <TH>{t("colState")}</TH>
              </TR>
            </THead>
            <TBody>
              {(events ?? []).map((e) => (
                <TR key={e.id}>
                  <TD className="text-muted-foreground">{formatDateTime(e.received_at, locale)}</TD>
                  <TD className="font-mono text-xs">{e.type}</TD>
                  <TD>
                    {e.processed_at ? <Badge variant="success">{t("processed")}</Badge> : e.last_error ? <Badge variant="destructive">{t("error")}</Badge> : <Badge variant="warning">{t("pending")}</Badge>}
                    {e.last_error && <p className="text-xs text-muted-foreground">{e.last_error.slice(0, 120)}</p>}
                    {e.attempts > 1 && <p className="text-xs text-muted-foreground">{t("attempts", { count: e.attempts })}</p>}
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
