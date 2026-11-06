import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { CURRENCIES, MARKETS } from "@/lib/domain";
import { formatDate, formatMoneyMinor } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AdminForm } from "@/components/admin/admin-form";
import { deactivatePlanAction, syncPlanAction, upsertPlanAction } from "../actions";

export default async function AdminPricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "pricing.manage");
  const [t, countryName] = await Promise.all([getTranslations("admin.pricing"), getCountryNamer()]);
  const supabase = await createClient();
  const { data: plans } = await supabase.from("pricing_plans").select("*").order("is_active", { ascending: false }).order("created_at", { ascending: false });
  const stripeReady = Boolean(getStripe());
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("newPlan")}</CardTitle>
          <CardDescription>{t("newPlanHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminForm action={upsertPlanAction} submitLabel={t("savePlan")} className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("country")}</span>
              <NativeSelect name="country" defaultValue="">
                <option value="">{t("allCountries")}</option>
                {MARKETS.map((c) => (
                  <option key={c} value={c}>
                    {countryName(c)}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("currency")}</span>
              <NativeSelect name="currency" defaultValue="EUR">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("amount")}</span>
              <Input name="amount" inputMode="decimal" placeholder="5.95" required />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("tax")}</span>
              <NativeSelect name="taxBehavior" defaultValue="exclusive">
                <option value="exclusive">{t("taxExclusive")}</option>
                <option value="inclusive">{t("taxInclusive")}</option>
              </NativeSelect>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("notes")}</span>
              <Input name="notes" maxLength={500} />
            </label>
          </AdminForm>
        </CardContent>
      </Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("colScope")}</TH>
            <TH>{t("colPrice")}</TH>
            <TH>{t("colStripe")}</TH>
            <TH>{t("colStatus")}</TH>
            <TH>
              <span className="sr-only">{t("colActions")}</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {(plans ?? []).map((p) => (
            <TR key={p.id}>
              <TD>
                {p.country_code ? countryName(p.country_code) : t("allCountries")}
                <p className="text-xs text-muted-foreground">{formatDate(p.created_at, locale)}</p>
              </TD>
              <TD className="font-semibold">
                {formatMoneyMinor(p.unit_amount, p.currency, locale)} <span className="text-xs font-normal text-muted-foreground">{p.tax_behavior === "exclusive" ? t("taxExclusiveShort") : t("taxInclusiveShort")}</span>
              </TD>
              <TD className="font-mono text-xs">{p.stripe_price_id ?? t("inlinePrice")}</TD>
              <TD>
                <Badge variant={p.is_active ? "success" : "muted"}>{p.is_active ? t("active") : t("inactive")}</Badge>
              </TD>
              <TD>
                {p.is_active && (
                  <div className="flex flex-wrap gap-2">
                    {stripeReady && !p.stripe_price_id && <AdminForm action={syncPlanAction} hidden={{ planId: p.id }} submitLabel={t("sync")} size="sm" variant="outline" />}
                    <AdminForm action={deactivatePlanAction} hidden={{ planId: p.id }} submitLabel={t("deactivate")} size="sm" variant="ghost" confirmText={t("deactivateConfirm")} />
                  </div>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="text-xs text-muted-foreground">{t("immutableNotice")}</p>
    </div>
  );
}
