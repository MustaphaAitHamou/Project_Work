import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, CircleDashed, FileDown, XCircle, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATION_STATUS_VARIANT } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { AdminForm } from "@/components/admin/admin-form";
import { reviewCompanyAction, suspendCompanyAction } from "../../actions";

const ICON = { pass: CheckCircle2, fail: XCircle, warn: AlertTriangle, unavailable: CircleDashed } as const;

export default async function AdminCompanyPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requirePermission(locale, "companies.view");
  const canVerify = hasPermission(user.roles, "companies.verify");
  const supabase = await createClient();
  const [{ data: c }, { data: members }, { data: reports }, { data: docs }, { data: notes }, t, te, countryName] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).maybeSingle(),
    supabase.from("company_members").select("role, job_title, phone, is_legal_representative, user_id, users(first_name, last_name, email)").eq("company_id", id),
    supabase.from("company_verifications").select("*").eq("company_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("company_verification_documents").select("id, doc_type, original_filename, created_at, file_deleted_at").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("admin_internal_notes").select("note, created_at").eq("target_type", "company").eq("target_id", id).order("created_at", { ascending: false }),
    getTranslations("admin.companies"),
    getTranslations("enums"),
    getCountryNamer(),
  ]);
  if (!c) notFound();
  const tv = await getTranslations("employer.company");
  return (
    <div className="space-y-6">
      <PageHeader title={c.legal_name} description={c.display_name ?? undefined} actions={<Badge variant={VERIFICATION_STATUS_VARIANT[c.verification_status]}>{te(`verificationStatus.${c.verification_status}`)}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("registration")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t("country")}</dt>
                  <dd>{countryName(c.registration_country)}{c.registration_region ? ` (${c.registration_region})` : ""}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tv(`idTypes.${c.registration_id_type}` as never)}</dt>
                  <dd className="font-mono">{c.registration_number}</dd>
                </div>
                {Object.entries((c.secondary_identifiers as Record<string, string>) ?? {}).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{tv(`secondary.${k}` as never)}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t("hq")}</dt>
                  <dd>{[c.hq_address_line1, c.hq_address_line2, `${c.hq_postal_code ?? ""} ${c.hq_city}`.trim(), countryName(c.hq_country)].filter(Boolean).join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("website")}</dt>
                  <dd>{c.website ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("members")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {(members ?? []).map((m) => {
                  const u = m.users as unknown as { first_name: string; last_name: string; email: string } | null;
                  return (
                    <li key={m.user_id} className="py-2">
                      <p className="font-medium">
                        {u?.first_name} {u?.last_name} · {m.job_title ?? "—"} {m.is_legal_representative && <Badge variant="secondary">{t("legalRep")}</Badge>}
                      </p>
                      <p className="text-muted-foreground">
                        {u?.email} {m.phone ? `· ${m.phone}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("reports")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!reports?.length && <p className="text-sm text-muted-foreground">{t("noReports")}</p>}
              {(reports ?? []).map((r) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {formatDateTime(r.created_at, locale)} · {r.method === "manual" ? t("manual") : (r.provider ?? t("automatic"))}
                    <Badge variant={VERIFICATION_STATUS_VARIANT[r.outcome]}>{te(`verificationStatus.${r.outcome}`)}</Badge>
                    {r.score !== null && <span className="text-muted-foreground">{t("score", { score: r.score })}</span>}
                  </p>
                  {r.registry_name && <p className="text-muted-foreground">{t("registryName", { name: r.registry_name })}</p>}
                  {r.decision_reason && <p className="text-muted-foreground">{t("decision", { reason: r.decision_reason })}</p>}
                  {Array.isArray(r.checks) && r.checks.length > 0 && (
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {(r.checks as { key: string; result: keyof typeof ICON; detail?: string }[]).map((ch) => {
                        const I = ICON[ch.result] ?? CircleDashed;
                        return (
                          <li key={ch.key} className="flex items-center gap-1.5">
                            <I className="size-4 shrink-0" aria-hidden />
                            <span>{t(`checks.${ch.key}` as never)}</span>
                            <span className="sr-only">{ch.result}</span>
                            {ch.detail && <span className="truncate text-xs text-muted-foreground">({ch.detail})</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {r.risk_flags?.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{t("flags", { flags: r.risk_flags.join(", ") })}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("documents")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!docs?.length ? (
                <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {d.original_filename} <span className="text-xs text-muted-foreground">({formatDateTime(d.created_at, locale)})</span>
                      </span>
                      {canVerify && !d.file_deleted_at && (
                        <a href={`/api/verification-documents/${d.id}/download`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <FileDown className="size-4" aria-hidden />
                          {t("open")}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{t("documentsLogged")}</p>
            </CardContent>
          </Card>
          {canVerify && (
            <Card>
              <CardHeader>
                <CardTitle>{t("decisionTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminForm action={reviewCompanyAction} hidden={{ companyId: c.id }} submitLabel={t("record")}>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("decisionLabel")}</span>
                    <NativeSelect name="decision" defaultValue="verified">
                      <option value="verified">{t("approve")}</option>
                      <option value="manual_review">{t("requestDocuments")}</option>
                      <option value="rejected">{t("reject")}</option>
                    </NativeSelect>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("messageToCompany")}</span>
                    <Textarea name="message" rows={3} maxLength={1000} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("internalNote")}</span>
                    <Textarea name="internalNote" rows={3} maxLength={4000} />
                  </label>
                </AdminForm>
              </CardContent>
            </Card>
          )}
          {canVerify && (
            <Card>
              <CardHeader>
                <CardTitle>{c.suspended_at ? t("unsuspendTitle") : t("suspendTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminForm action={suspendCompanyAction} hidden={{ companyId: c.id, suspend: c.suspended_at ? "false" : "true" }} submitLabel={c.suspended_at ? t("unsuspend") : t("suspend")} variant={c.suspended_at ? "outline" : "destructive"} confirmText={c.suspended_at ? undefined : t("suspendConfirm")}>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("reason")}</span>
                    <Textarea name="reason" rows={2} required maxLength={1000} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("internalNote")}</span>
                    <Textarea name="internalNote" rows={2} maxLength={4000} />
                  </label>
                </AdminForm>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("internalNotes")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!notes?.length ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {notes.map((n, i) => (
                    <li key={i}>
                      <p className="whitespace-pre-line">{n.note}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at, locale)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
