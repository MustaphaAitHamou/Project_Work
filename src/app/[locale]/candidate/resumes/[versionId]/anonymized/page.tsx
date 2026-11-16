import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, EyeOff, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redactionTotal, type RedactionCategory } from "@/lib/privacy/redact";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AnonymizedCvForm } from "@/components/candidate/anonymized-cv-form";
import type { AnonymizedStatus } from "@/components/candidate/resume-manager";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "anonymity" });
  return { title: t("cv.title"), robots: { index: false } };
}

/** The candidate checks, corrects and approves the text recruiters read during preselection. */
export default async function AnonymizedCvPage({ params }: { params: Promise<{ locale: string; versionId: string }> }) {
  const { locale, versionId } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(versionId).success) notFound();
  const user = await requireCandidate(locale);
  const supabase = await createClient();
  const [{ data: version }, t] = await Promise.all([
    supabase
      .from("candidate_resume_versions")
      .select("id, resume_id, anonymized_text, anonymized_status, anonymized_summary, file_deleted_at")
      .eq("id", versionId)
      .eq("user_id", user.id)
      .maybeSingle(),
    getTranslations("anonymity"),
  ]);
  if (!version || version.file_deleted_at) notFound();
  // Two foreign keys link resumes and versions: the label is read separately.
  const { data: resume } = await supabase.from("candidate_resumes").select("label").eq("id", version.resume_id).maybeSingle();
  const status = version.anonymized_status as AnonymizedStatus;
  const masked = redactionTotal((version.anonymized_summary ?? {}) as Partial<Record<RedactionCategory, number>>);
  const label = resume?.label;
  return (
    <div className="space-y-6">
      <Link href="/candidate/resumes" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("cv.back")}
      </Link>
      <PageHeader
        title={t("cv.title")}
        description={label}
        actions={
          <Badge variant={status === "approved" ? "success" : "warning"}>
            <EyeOff aria-hidden />
            {t(`cv.status.${status}`)}
          </Badge>
        }
      />
      <p className="max-w-3xl text-base leading-relaxed">{t("cv.intro")}</p>
      <Alert variant="warning">
        <ShieldAlert aria-hidden />
        <AlertDescription>
          <p>{t("cv.warning")}</p>
          {status !== "pending" && <p className="mt-1 font-medium">{t("cv.summary", { count: masked })}</p>}
        </AlertDescription>
      </Alert>
      {status !== "approved" && <p className="text-sm text-muted-foreground">{t("cv.notShared")}</p>}
      <AnonymizedCvForm versionId={version.id} initialText={version.anonymized_text ?? ""} status={status} />
    </div>
  );
}
