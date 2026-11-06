import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const Flag = ({ on, label }: { on: boolean; label: string }) => (on ? <Check className="size-4 text-success" aria-label={label} /> : <X className="size-4 text-muted-foreground" aria-label={label} />);

export default async function AdminCountriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "countries.manage");
  const [t, te, countryName] = await Promise.all([getTranslations("admin.countries"), getTranslations("enums"), getCountryNamer()]);
  const supabase = await createClient();
  const [{ data: countries }, { data: items }] = await Promise.all([
    supabase.from("countries").select("*").order("sort_order"),
    supabase.from("country_compliance_items").select("country_code, is_blocking, status"),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      <Table>
        <THead>
          <TR>
            <TH>{t("colCountry")}</TH>
            <TH>{t("colBrowsable")}</TH>
            <TH>{t("colRegistration")}</TH>
            <TH>{t("colPaid")}</TH>
            <TH>{t("colAuto")}</TH>
            <TH>{t("colCompliance")}</TH>
          </TR>
        </THead>
        <TBody>
          {(countries ?? []).map((c) => {
            const blocking = (items ?? []).filter((i) => i.country_code === c.code && i.is_blocking);
            const done = blocking.filter((i) => i.status === "done" || i.status === "not_applicable").length;
            const yes = t("yes");
            const no = t("no");
            return (
              <TR key={c.code}>
                <TD>
                  <Link href={`/admin/countries/${c.code}`} className="font-medium hover:text-primary">
                    {countryName(c.code)}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {c.default_currency} · {c.default_locale}
                  </p>
                </TD>
                <TD>
                  <Flag on={c.is_browsable} label={c.is_browsable ? yes : no} />
                </TD>
                <TD>
                  <Flag on={c.is_registration_open} label={c.is_registration_open ? yes : no} />
                </TD>
                <TD>
                  <Flag on={c.is_paid_publishing_enabled} label={c.is_paid_publishing_enabled ? yes : no} />
                </TD>
                <TD>
                  <Flag on={c.auto_verification_enabled} label={c.auto_verification_enabled ? yes : no} />
                </TD>
                <TD>
                  <Badge variant={c.compliance_status === "validated" ? "success" : c.compliance_status === "blocked" ? "destructive" : "warning"}>{te(`complianceStatus.${c.compliance_status}` as never)}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{t("blockingDone", { done, total: blocking.length })}</p>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
