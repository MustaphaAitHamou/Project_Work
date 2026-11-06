import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATION_STATUS_VARIANT, type VerificationStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUSES: VerificationStatus[] = ["pending", "auto_check", "manual_review", "verified", "rejected", "suspended"];

export default async function AdminCompaniesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "companies.view");
  const sp = await searchParams;
  const [t, te, countryName] = await Promise.all([getTranslations("admin.companies"), getTranslations("enums"), getCountryNamer()]);
  const supabase = await createClient();
  const status = (STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as VerificationStatus) : null;
  let query = supabase.from("companies").select("id, legal_name, display_name, registration_country, registration_id_type, registration_number, verification_status, created_at").order("created_at", { ascending: true }).limit(200);
  query = status ? query.eq("verification_status", status) : query.in("verification_status", ["pending", "auto_check", "manual_review"]);
  const q = (sp.q ?? "").trim().slice(0, 80);
  if (q) query = query.or(`legal_name.ilike.%${q.replace(/[%_,()]/g, "")}%,registration_number.ilike.%${q.replace(/[%_,()]/g, "")}%`);
  const { data } = await query;
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <Input name="q" defaultValue={q} placeholder={t("search")} className="max-w-xs" aria-label={t("search")} />
        <NativeSelect name="status" defaultValue={status ?? ""} className="w-60" aria-label={t("status")}>
          <option value="">{t("queue")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {te(`verificationStatus.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          {t("filter")}
        </Button>
      </form>
      {!data?.length ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("colCompany")}</TH>
              <TH>{t("colCountry")}</TH>
              <TH>{t("colIdentifier")}</TH>
              <TH>{t("colStatus")}</TH>
              <TH>{t("colCreated")}</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/admin/companies/${c.id}`} className="font-medium hover:text-primary">
                    {c.legal_name}
                  </Link>
                  {c.display_name && <p className="text-xs text-muted-foreground">{c.display_name}</p>}
                </TD>
                <TD>{countryName(c.registration_country)}</TD>
                <TD className="font-mono text-xs">{c.registration_number}</TD>
                <TD>
                  <Badge variant={VERIFICATION_STATUS_VARIANT[c.verification_status]}>{te(`verificationStatus.${c.verification_status}`)}</Badge>
                </TD>
                <TD className="text-muted-foreground">{formatDate(c.created_at, locale)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
