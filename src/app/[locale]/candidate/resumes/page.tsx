import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPublicSetting } from "@/lib/jobs/queries";
import { UPLOAD_HARD_LIMIT_BYTES } from "@/lib/domain";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { ResumeManager, type ResumeItem } from "@/components/candidate/resume-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "candidate.resumes" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ResumesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const t = await getTranslations("candidate.resumes");
  const supabase = await createClient();
  const [{ data: resumes }, { data: versions }, { data: apps }, maxSetting, retention] = await Promise.all([
    supabase.from("candidate_resumes").select("id, label, is_primary, updated_at, current_version_id").eq("user_id", user.id).is("deleted_at", null).order("created_at"),
    supabase.from("candidate_resume_versions").select("id, resume_id, original_filename, size_bytes, created_at, mime_type").eq("user_id", user.id),
    supabase.from("applications").select("resume_version_id").eq("candidate_id", user.id).neq("status", "withdrawn"),
    getPublicSetting<number>("uploads.resume_max_bytes", UPLOAD_HARD_LIMIT_BYTES),
    getPublicSetting<number>("retention.applications_months", 24),
  ]);
  const sent = new Set((apps ?? []).map((a) => a.resume_version_id));
  const items: ResumeItem[] = (resumes ?? []).map((r) => {
    const v = (versions ?? []).find((x) => x.id === r.current_version_id) ?? null;
    return {
      id: r.id,
      label: r.label,
      is_primary: r.is_primary,
      updated_at: r.updated_at,
      current: v,
      sentVersions: (versions ?? []).filter((x) => x.resume_id === r.id && sent.has(x.id)).length,
    };
  });
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ResumeManager items={items} maxBytes={Math.min(Number(maxSetting), UPLOAD_HARD_LIMIT_BYTES)} />
      <Alert variant="info">
        <ShieldCheck aria-hidden />
        <AlertDescription>{t("policy", { months: Number(retention) })}</AlertDescription>
      </Alert>
    </div>
  );
}
