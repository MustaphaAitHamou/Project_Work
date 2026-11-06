import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { activateJob, createCompany, createDraftJob, createTestUser, sql } from "../helpers/supabase";
import { emailSubjects } from "./helpers";

const CRON = { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` };

test.describe("Scheduled jobs", () => {
  test("refuse calls without the cron secret", async ({ request }) => {
    for (const path of ["/api/cron/maintenance", "/api/cron/emails", "/api/cron/alerts"]) {
      expect((await request.get(path)).status()).toBe(401);
      expect((await request.get(path, { headers: { authorization: "Bearer wrong-secret-value-123" } })).status()).toBe(401);
    }
  });

  test("job alerts: a new matching advert is e-mailed once, older or unrelated ones are not", async ({ request }) => {
    const keyword = `orthoptiste${randomUUID().slice(0, 6)}`;
    const candidate = await createTestUser("candidate", { firstName: "Iris", lastName: "Alerte" });
    const alertName = `Alerte ${keyword}`;
    const inserted = await candidate.client.from("job_alerts").insert({ user_id: candidate.id, name: alertName, criteria: { q: keyword }, frequency: "daily", email_enabled: true });
    expect(inserted.error).toBeNull();

    const company = await createCompany();
    const matching = await createDraftJob(company, { title: `Orthoptiste ${keyword}`, required_skills: [keyword] });
    await activateJob(matching.id);
    const unrelated = await createDraftJob(company, { title: "Boulanger de nuit" });
    await activateJob(unrelated.id);

    const run = await request.get("/api/cron/alerts", { headers: CRON });
    expect(run.status()).toBe(200);
    const [mail] = await sql(`select payload from public.email_outbox where user_id = $1 and template = 'job_alert_digest'`, [candidate.id]);
    expect(mail.payload.alert_name).toBe(alertName);
    expect(mail.payload.jobs.map((j: { title: string }) => j.title)).toEqual([`Orthoptiste ${keyword}`]);
    await expect.poll(() => emailSubjects(candidate.email)).toContain(`1 nouvelle offre pour « ${alertName} »`);

    // Same day, second run: nothing new is sent.
    await sql(`update public.job_alerts set last_run_at = now() - interval '2 days' where user_id = $1`, [candidate.id]);
    await request.get("/api/cron/alerts", { headers: CRON });
    expect(await sql(`select 1 from public.email_outbox where user_id = $1 and template = 'job_alert_digest'`, [candidate.id])).toHaveLength(1);
  });

  test("maintenance: unpaid adverts past the grace period are suspended and the company is told", async ({ request }) => {
    const company = await createCompany();
    const job = await createDraftJob(company, { title: "Agent de maintenance (grâce)" });
    await activateJob(job.id);
    // The renewal failed (Stripe marked the subscription past_due) and the grace period has elapsed.
    await sql(
      `insert into public.subscriptions (company_id, job_id, status, stripe_subscription_id, grace_until, currency, unit_amount)
       values ($1, $2, 'past_due', $3, now() - interval '1 hour', 'EUR', 595)`,
      [company.companyId, job.id, `sub_grace_${randomUUID().slice(0, 10)}`],
    );
    const res = await request.get("/api/cron/maintenance", { headers: CRON });
    expect(res.status()).toBe(200);
    expect((await sql(`select status, suspension_reason from public.jobs where id = $1`, [job.id]))[0]).toMatchObject({ status: "suspended", suspension_reason: "payment_failed" });
    const mails = await sql(`select template from public.email_outbox where user_id = $1`, [company.owner.id]);
    expect(mails.map((m) => m.template)).toContain("job_suspended_payment");
  });
});
