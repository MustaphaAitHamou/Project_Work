import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { jobPath, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveJobButton } from "@/components/jobs/save-job-button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "candidate.saved" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SavedJobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const t = await getTranslations("candidate.saved");
  const supabase = await createClient();
  const { data: saved } = await supabase.from("saved_jobs").select("job_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  const ids = (saved ?? []).map((s) => s.job_id);
  const { data: jobs } = ids.length
    ? await supabase.from("public_jobs").select("id, title, slug, public_id, company_name, city, is_open").in("id", ids)
    : { data: [] };
  const byId = new Map((jobs ?? []).map((j) => [j.id, j]));
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      {!saved?.length ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{t("empty")}</p>
          <Button asChild className="mt-4">
            <Link href="/jobs">{t("browse")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {saved.map((s) => {
            const j = byId.get(s.job_id);
            return (
              <li key={s.job_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div className="min-w-0">
                  {j ? (
                    <Link href={jobPath(j.slug!, j.public_id!)} className="font-semibold hover:text-primary">
                      {j.title}
                    </Link>
                  ) : (
                    <span className="font-semibold text-muted-foreground">{t("unavailable")}</span>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {j ? `${j.company_name} · ${j.city} · ` : ""}
                    {t("savedOn", { date: formatDate(s.created_at, locale) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {j && !j.is_open && <Badge variant="muted">{t("closed")}</Badge>}
                  <div className="w-40">
                    <SaveJobButton jobId={s.job_id} initialSaved />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
