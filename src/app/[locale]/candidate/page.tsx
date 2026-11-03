import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Circle, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_VARIANT, type ApplicationStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STEPS = [
  { key: "identity", fields: ["first_name", "last_name"], href: "/candidate/profile" },
  { key: "headline", fields: ["headline"], href: "/candidate/profile" },
  { key: "location", fields: ["country", "city"], href: "/candidate/profile" },
  { key: "skills", fields: ["skills"], href: "/candidate/profile" },
  { key: "resume", fields: ["resume"], href: "/candidate/resumes" },
] as const;

export default async function CandidateHome({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const sp = await searchParams;
  const t = await getTranslations("candidate.home");
  const te = await getTranslations("enums");
  const supabase = await createClient();
  const [{ data: status }, { data: apps }, { count: savedCount }, { count: alertCount }, { count: appCount }] = await Promise.all([
    supabase.rpc("get_my_candidate_status"),
    supabase
      .from("applications")
      .select("id, status, created_at, jobs(title, slug, public_id, companies(display_name, legal_name))")
      .eq("candidate_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("saved_jobs").select("job_id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("job_alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("candidate_id", user.id),
  ]);
  const s = (status ?? {}) as { complete?: boolean; missing?: string[] };
  const missing = new Set(s.missing ?? []);
  const done = STEPS.filter((st) => st.fields.every((f) => !missing.has(f))).length;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title", { name: user.firstName })} description={t("subtitle")} actions={<Button asChild><Link href="/jobs"><Search aria-hidden />{t("searchJobs")}</Link></Button>} />
      {sp.welcome && (
        <Alert variant="success">
          <AlertTitle>{t("welcomeTitle")}</AlertTitle>
          <AlertDescription>{t("welcomeText")}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{s.complete ? t("readyTitle") : t("completeTitle")}</CardTitle>
          <CardDescription>{s.complete ? t("readyText") : t("completeText", { done, total: STEPS.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={STEPS.length} aria-label={t("progress")}>
            <div className="h-full bg-primary transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {STEPS.map((st) => {
              const ok = st.fields.every((f) => !missing.has(f));
              return (
                <li key={st.key}>
                  <Link href={st.href} className="flex items-center gap-2 rounded-md p-1 text-sm hover:bg-muted">
                    {ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Circle className="size-4 text-muted-foreground" aria-hidden />}
                    <span className={ok ? "text-muted-foreground line-through" : ""}>{t(`steps.${st.key}`)}</span>
                    <span className="sr-only">{ok ? t("stepDone") : t("stepTodo")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("statApplications"), value: appCount ?? 0, href: "/candidate/applications" },
          { label: t("statSaved"), value: savedCount ?? 0, href: "/candidate/saved" },
          { label: t("statAlerts"), value: alertCount ?? 0, href: "/candidate/alerts" },
        ].map((k) => (
          <Link key={k.href} href={k.href} className="rounded-xl border bg-card p-5 hover:shadow-sm">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-bold">{k.value}</p>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("recentApplications")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!apps?.length ? (
            <p className="text-sm text-muted-foreground">{t("noApplications")}</p>
          ) : (
            <ul className="divide-y">
              {apps.map((a) => {
                const job = a.jobs as unknown as { title: string; slug: string; public_id: string; companies: { display_name: string | null; legal_name: string } } | null;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job?.title}</p>
                      <p className="text-muted-foreground">
                        {job?.companies?.display_name ?? job?.companies?.legal_name} · {formatDate(a.created_at, locale)}
                      </p>
                    </div>
                    <Badge variant={APPLICATION_STATUS_VARIANT[a.status as ApplicationStatus]}>{te(`applicationStatus.${a.status}`)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
