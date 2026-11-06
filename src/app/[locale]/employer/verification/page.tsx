import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Clock, ShieldAlert, ShieldX } from "lucide-react";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { createClient } from "@/lib/supabase/server";
import { VERIFICATION_STATUS_VARIANT } from "@/lib/domain";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationPanel } from "@/components/employer/verification-panel";

export default async function VerificationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const [t, te] = await Promise.all([getTranslations("employer.verification"), getTranslations("enums")]);
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("company_verification_documents")
    .select("id, doc_type, original_filename, created_at")
    .eq("company_id", mine.company.id)
    .is("file_deleted_at", null)
    .order("created_at", { ascending: false });
  const status = mine.company.verification_status;
  const Icon = status === "verified" ? CheckCircle2 : status === "rejected" || status === "suspended" ? ShieldX : status === "manual_review" ? ShieldAlert : Clock;
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <Icon className="size-6 text-primary" aria-hidden />
          <CardTitle className="flex flex-wrap items-center gap-2">
            {t("statusLabel")} <Badge variant={VERIFICATION_STATUS_VARIANT[status]}>{te(`verificationStatus.${status}`)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {mine.company.verification_message && <p className="rounded-lg bg-muted/50 p-3">{mine.company.verification_message}</p>}
          <p className="text-muted-foreground">{t(`explain_${status}`)}</p>
          <h3 className="pt-2 font-semibold">{t("howTitle")}</h3>
          <ol className="list-decimal space-y-1 ps-5 text-muted-foreground">
            <li>{t("how1")}</li>
            <li>{t("how2")}</li>
            <li>{t("how3")}</li>
            <li>{t("how4")}</li>
          </ol>
        </CardContent>
      </Card>
      <VerificationPanel
        companyId={mine.company.id}
        canRerun={["pending", "manual_review", "rejected"].includes(status)}
        canUpload={status !== "verified" && status !== "suspended"}
        documents={documents ?? []}
      />
    </div>
  );
}
