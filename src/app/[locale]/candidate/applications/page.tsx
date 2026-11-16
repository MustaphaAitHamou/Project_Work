import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/lib/domain";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { ApplicationsList, type CandidateApplication, type RevealRow } from "@/components/candidate/applications-list";

/** Most recent disclosure request; a pending one past its deadline counts as expired. */
function latestReveal(rows: RevealRow[]): RevealRow | null {
  const last = [...rows].sort((x, y) => y.requested_at.localeCompare(x.requested_at))[0];
  if (!last) return null;
  return last.status === "pending" && new Date(last.expires_at) < new Date() ? { ...last, status: "expired" } : last;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "candidate.applications" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const t = await getTranslations("candidate.applications");
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "id, status, created_at, status_changed_at, job_id, job_title, company_name, public_alias, application_status_history(to_status, created_at), application_identity_reveals(status, origin, requested_at, expires_at, responded_at, revoked_at)",
    )
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  // Job titles come from the public read model (the candidate is not a company member).
  const jobIds = [...new Set((data ?? []).map((a) => a.job_id))];
  const { data: jobs } = jobIds.length
    ? await supabase.from("public_jobs").select("id, title, slug, public_id, status, company_name").in("id", jobIds)
    : { data: [] };
  const byId = new Map((jobs ?? []).map((j) => [j.id, j]));
  const items: CandidateApplication[] = (data ?? []).map((a) => {
    const j = byId.get(a.job_id);
    const history = ((a.application_status_history ?? []) as { to_status: ApplicationStatus; created_at: string }[]).sort((x, y) => x.created_at.localeCompare(y.created_at));
    return {
      id: a.id,
      status: a.status,
      created_at: a.created_at,
      status_changed_at: a.status_changed_at,
      job: j ? { title: j.title!, slug: j.slug!, public_id: j.public_id!, status: j.status! } : null,
      jobTitle: a.job_title,
      company: a.company_name || j?.company_name || "—",
      history,
      alias: a.public_alias,
      reveal: latestReveal((a.application_identity_reveals ?? []) as RevealRow[]),
    };
  });
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <ApplicationsList items={items} />
    </div>
  );
}
