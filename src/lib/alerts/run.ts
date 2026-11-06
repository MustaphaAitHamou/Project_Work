import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertCriteria, parseSearchParams, toQueryString, toRpcArgs, type SearchParams } from "@/lib/search/params";

/**
 * Job alerts: for each due alert, finds adverts published since the previous run
 * and enqueues one digest e-mail (deduplicated per alert and per day).
 */
export async function runJobAlerts(now = new Date(), limit = 500) {
  const admin = createAdminClient();
  const dayAgo = new Date(now.getTime() - 23 * 3600_000).toISOString();
  const weekAgo = new Date(now.getTime() - (7 * 24 - 1) * 3600_000).toISOString();
  const { data: alerts, error } = await admin
    .from("job_alerts")
    .select("id, user_id, name, criteria, frequency, last_run_at, created_at, users!inner(status, notify_job_alerts, locale, email)")
    .eq("email_enabled", true)
    .or(`and(frequency.eq.daily,or(last_run_at.is.null,last_run_at.lt.${dayAgo})),and(frequency.eq.weekly,or(last_run_at.is.null,last_run_at.lt.${weekAgo}))`)
    .limit(limit);
  if (error) throw new Error(`job_alerts: ${error.message}`);
  const sentIds: string[] = [];
  for (const alert of alerts ?? []) {
    const user = alert.users as unknown as { status: string; notify_job_alerts: boolean; locale: string; email: string };
    const since = alert.last_run_at ?? alert.created_at;
    if (user.status === "active" && user.notify_job_alerts) {
      const criteria = alertCriteria(parseSearchParams(new URLSearchParams(toQueryString(alert.criteria as SearchParams))));
      let coords: { lat: number; lng: number } | null = null;
      if (criteria.near) {
        const { data: city } = await admin.from("geo_cities").select("latitude, longitude").eq("id", criteria.near).maybeSingle();
        coords = city ? { lat: city.latitude, lng: city.longitude } : null;
      }
      const args = { ...toRpcArgs({ ...criteria, sort: "date", page: 1 }, user.locale, coords, 20), p_published_after: since };
      const { data: jobs } = await admin.rpc("search_jobs", args as never);
      const rows = (jobs ?? []) as { title: string; company_name: string; city: string; slug: string; public_id: string }[];
      if (rows.length > 0) {
        const { error: insertError } = await admin.from("email_outbox").insert({
          user_id: alert.user_id,
          to_email: user.email,
          locale: user.locale,
          template: "job_alert_digest",
          payload: {
            alert_name: alert.name,
            query: toQueryString(criteria),
            jobs: rows.map((j) => ({ title: j.title, company: j.company_name, city: j.city, path: `/jobs/${j.slug}-${j.public_id}` })),
          },
          dedupe_key: `alert:${alert.id}:${now.toISOString().slice(0, 10)}`,
        });
        if (!insertError) sentIds.push(alert.id);
      }
    }
    await admin.from("job_alerts").update({ last_run_at: now.toISOString() }).eq("id", alert.id);
  }
  if (sentIds.length > 0) await admin.from("job_alerts").update({ last_sent_at: now.toISOString() }).in("id", sentIds);
  return { processed: alerts?.length ?? 0, digests: sentIds.length };
}
