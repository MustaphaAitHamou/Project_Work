/**
 * Launch offer: free publication for every company until 31 December 2026 23:59:59
 * (Europe/Paris), then the paid model (5.95 EUR excl. VAT per month and per advert).
 *
 * Simulated clock: the end of the offer is moved relative to now (platform setting), and
 * per-advert end instants are moved in the past to reproduce "the end has passed but the
 * scheduled maintenance has not run yet". The server clock is never changed.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCompany,
  createDraftJob,
  createReadyCandidate,
  db,
  grantAdminRole,
  restoreFreePeriod,
  serviceClient,
  setFreePublicationUntil,
  sql,
  type TestCompany,
} from "../../helpers/supabase";

const HOUR = 3600_000;
const sid = (prefix: string) => `${prefix}_${randomUUID().slice(0, 12)}`;
const job = async (id: string) =>
  (
    await sql<{
      status: string;
      suspension_reason: string | null;
      free_until: Date | null;
      paid_through: Date | null;
      published_at: Date | null;
    }>(`select status, suspension_reason, free_until, paid_through, published_at from public.jobs where id = $1`, [id])
  )[0];
/** Ids returned by the public search for "React" (the default title of test adverts). */
async function searchIds(): Promise<string> {
  const res = await serviceClient.rpc("search_jobs", {
    p_q: "React",
    p_lang: "fr",
    p_sort: "date",
    p_limit: 100,
    p_offset: 0,
  } as never);
  if (res.error || !res.data) throw res.error ?? new Error("search_jobs returned nothing");
  return JSON.stringify(res.data);
}
const isPublic = async (id: string) => (await serviceClient.from("public_jobs").select("id, is_open").eq("id", id)).data ?? [];
const outbox = async (template: string, companyId: string) =>
  (
    await sql(
      `select count(*)::int as n from public.email_outbox o join public.company_members m on m.user_id = o.user_id
               where o.template = $1 and m.company_id = $2`,
      [template, companyId],
    )
  )[0].n as number;

/** An advert online for free (the offer ends in one hour). */
async function freeAdvert(company: TestCompany) {
  await setFreePublicationUntil(new Date(Date.now() + HOUR));
  const draft = await createDraftJob(company);
  const res = await company.owner.client.rpc("submit_job", {
    p_job_id: draft.id,
  });
  if (res.error) throw res.error;
  return {
    ...draft,
    submitted: res.data as { status: string; free_until: string | null },
  };
}

/** The end of the free period has passed for this advert; the maintenance has not run yet. */
const passEnd = (jobId: string) => sql(`update public.jobs set free_until = now() - interval '1 second' where id = $1`, [jobId]);

describe("launch offer: free publication until 31/12/2026 23:59:59 Paris", () => {
  let company: TestCompany;

  beforeEach(async () => {
    company = await createCompany({ verified: true });
    await restoreFreePeriod();
  });
  afterAll(restoreFreePeriod);

  it("ends exactly at midnight, Paris time (31/12 23:59:59 free, 01/01 00:00 paid)", async () => {
    const [r] = await sql<{
      until: Date;
      before: boolean;
      last: boolean;
      at: boolean;
      after: boolean;
    }>(`
      select app.free_publication_until() as until,
             app.free_publication_open_at(timestamptz '2026-12-31 22:00:00 Europe/Paris') as before,
             app.free_publication_open_at(timestamptz '2026-12-31 23:59:59 Europe/Paris') as last,
             app.free_publication_open_at(timestamptz '2027-01-01 00:00:00 Europe/Paris') as at,
             app.free_publication_open_at(timestamptz '2027-01-01 00:00:01 Europe/Paris') as after`);
    expect(r.until.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(r).toMatchObject({
      before: true,
      last: true,
      at: false,
      after: false,
    });
    const offer = await serviceClient.rpc("launch_offer");
    expect(offer.data).toMatchObject({
      open: true,
      free_until: "2026-12-31T23:00:00+00:00",
    });
  });

  it("during the offer: published at once without card, public, searchable and open to applications", async () => {
    const advert = await freeAdvert(company);
    expect(advert.submitted.status).toBe("active");
    const row = await job(advert.id);
    expect(row.published_at).not.toBeNull();
    expect(row.free_until!.getTime()).toBeGreaterThan(Date.now());
    expect(await sql(`select count(*)::int as n from public.subscriptions where job_id = $1`, [advert.id])).toEqual([{ n: 0 }]);
    expect(await isPublic(advert.id)).toEqual([{ id: advert.id, is_open: true }]);

    expect(await searchIds()).toContain(advert.id);

    const candidate = await createReadyCandidate();
    const applied = await candidate.client.rpc("apply_to_job", {
      p_job_id: advert.id,
    });
    expect(applied.error).toBeNull();
  });

  it("compliance and moderation still apply: a discriminatory advert goes to human review, approval publishes it for free", async () => {
    await setFreePublicationUntil(new Date(Date.now() + HOUR));
    const biased = await createDraftJob(company, {
      description:
        "Nous recherchons un jeune homme de moins de 30 ans, nationalité française exigée, pour un poste de commercial terrain dans notre agence.",
    });
    const res = await company.owner.client.rpc("submit_job", {
      p_job_id: biased.id,
    });
    expect(res.data).toMatchObject({ status: "in_review" });
    expect(await isPublic(biased.id)).toEqual([]);

    const moderator = await (await import("../../helpers/supabase")).createTestUser("candidate", { firstName: "Mo", lastName: "Deration" });
    await grantAdminRole(moderator.id, "moderator");
    await sql(`update public.platform_settings set value = 'false' where key = 'security.admin_mfa_required'`);
    const approved = await moderator.client.rpc("admin_moderate_job", {
      p_job_id: biased.id,
      p_decision: "approve",
    });
    expect(approved.error).toBeNull();
    expect(approved.data).toMatchObject({ status: "active" });
    expect((await job(biased.id)).free_until).not.toBeNull();
  });

  it("at the end instant, before any maintenance: no longer public, searchable or open to applications", async () => {
    const advert = await freeAdvert(company);
    const candidate = await createReadyCandidate();
    const before = await candidate.client.rpc("apply_to_job", {
      p_job_id: advert.id,
    });
    expect(before.error).toBeNull();

    await passEnd(advert.id);
    expect((await job(advert.id)).status).toBe("active"); // maintenance not run yet
    expect(await isPublic(advert.id)).toEqual([]);
    expect(await searchIds()).not.toContain(advert.id);
    expect(await sql(`select app.job_is_public($1) as p`, [advert.id])).toEqual([{ p: false }]);

    const other = await createReadyCandidate();
    const late = await other.client.rpc("apply_to_job", {
      p_job_id: advert.id,
    });
    expect(late.error?.message).toBe("job_not_open");
    // The existing application is kept.
    expect(await sql(`select count(*)::int as n from public.applications where job_id = $1`, [advert.id])).toEqual([{ n: 1 }]);
  });

  it("the maintenance records 'free_period_ended' once, tells the company once, keeps the advert and its applications", async () => {
    const advert = await freeAdvert(company);
    const candidate = await createReadyCandidate();
    await candidate.client.rpc("apply_to_job", { p_job_id: advert.id });
    await passEnd(advert.id);

    const first = await serviceClient.rpc("run_maintenance");
    expect(first.error).toBeNull();
    expect((first.data as { free_period_ended: number }).free_period_ended).toBeGreaterThanOrEqual(1);
    expect(await job(advert.id)).toMatchObject({
      status: "suspended",
      suspension_reason: "free_period_ended",
    });
    expect(await outbox("free_period_ended", company.companyId)).toBe(1);

    const second = await serviceClient.rpc("run_maintenance");
    expect(second.error).toBeNull();
    expect(await outbox("free_period_ended", company.companyId)).toBe(1);
    expect(await sql(`select count(*)::int as n from public.applications where job_id = $1`, [advert.id])).toEqual([{ n: 1 }]);
    // The recruiter still sees it in the private space.
    const own = await company.owner.client.from("jobs").select("id, status").eq("id", advert.id);
    expect(own.data).toEqual([{ id: advert.id, status: "suspended" }]);
  });

  it("a concurrent maintenance run is skipped instead of running twice", async () => {
    const holder = await db().connect();
    try {
      await holder.query("begin");
      await holder.query(`select pg_advisory_xact_lock(hashtext('tamurt_jobs.run_maintenance'))`);
      const res = await serviceClient.rpc("run_maintenance");
      expect(res.data).toEqual({ skipped: "already_running" });
      await holder.query("commit");
    } finally {
      holder.release();
    }
  });

  it("after the offer: a new advert needs a subscription and is never published without payment", async () => {
    await setFreePublicationUntil(new Date(Date.now() - HOUR));
    const draft = await createDraftJob(company);
    const res = await company.owner.client.rpc("submit_job", {
      p_job_id: draft.id,
    });
    expect(res.data).toMatchObject({ status: "pending_payment" });
    expect(await job(draft.id)).toMatchObject({
      status: "pending_payment",
      free_until: null,
    });
    expect(await isPublic(draft.id)).toEqual([]);
    // Reopening a closed advert is not free any more either.
    await sql(`update public.jobs set status = 'closed', published_at = now() where id = $1`, [draft.id]);
    const reopen = await company.owner.client.rpc("reopen_job", {
      p_job_id: draft.id,
    });
    expect(reopen.error?.message).toBe("reopen_requires_payment");
  });

  it("an advert not converted can be reactivated by a subscription; an unpaid checkout leaves it suspended", async () => {
    const advert = await freeAdvert(company);
    await passEnd(advert.id);
    await serviceClient.rpc("run_maintenance");
    expect((await job(advert.id)).suspension_reason).toBe("free_period_ended");

    const prep = await serviceClient.rpc("billing_prepare_checkout", {
      p_actor: company.owner.id,
      p_job_id: advert.id,
    });
    expect(prep.error).toBeNull();
    expect((prep.data as { trial_until: string | null }).trial_until).toBeNull(); // charged now: the offer is over
    const plan = (prep.data as { plan: { id: string } }).plan;

    // Failed attempt: nothing changes.
    const failedSession = sid("cs_test");
    await serviceClient.rpc("billing_register_checkout", {
      p_job_id: advert.id,
      p_plan_id: plan.id,
      p_session_id: failedSession,
      p_customer_id: sid("cus"),
    });
    await serviceClient.rpc("billing_checkout_completed", {
      p: {
        session_id: failedSession,
        subscription_id: sid("sub"),
        payment_status: "unpaid",
        job_id: advert.id,
        livemode: false,
      },
    });
    expect(await job(advert.id)).toMatchObject({
      status: "suspended",
      suspension_reason: "free_period_ended",
    });

    // Successful subscription (the failed one is not live: a new checkout is allowed).
    await sql(`update public.subscriptions set status = 'incomplete_expired' where job_id = $1`, [advert.id]);
    const session = sid("cs_test");
    await serviceClient.rpc("billing_register_checkout", {
      p_job_id: advert.id,
      p_plan_id: plan.id,
      p_session_id: session,
      p_customer_id: sid("cus"),
    });
    const paid = await serviceClient.rpc("billing_checkout_completed", {
      p: {
        session_id: session,
        subscription_id: sid("sub"),
        payment_status: "paid",
        job_id: advert.id,
        livemode: false,
      },
    });
    expect(paid.data).toMatchObject({ job_result: "activated" });
    expect(await job(advert.id)).toMatchObject({
      status: "active",
      suspension_reason: null,
      free_until: null,
    });
    expect(await isPublic(advert.id)).toEqual([{ id: advert.id, is_open: true }]);
  });

  it("converted before the end (trial until the end, no charge before): stays online after the end", async () => {
    const advert = await freeAdvert(company);
    const freeUntil = (await job(advert.id)).free_until!;
    const prep = await serviceClient.rpc("billing_prepare_checkout", {
      p_actor: company.owner.id,
      p_job_id: advert.id,
    });
    expect(prep.error).toBeNull();
    expect(new Date((prep.data as { trial_until: string }).trial_until).getTime()).toBe(freeUntil.getTime());

    const plan = (prep.data as { plan: { id: string } }).plan;
    const session = sid("cs_test");
    const subscriptionId = sid("sub");
    await serviceClient.rpc("billing_register_checkout", {
      p_job_id: advert.id,
      p_plan_id: plan.id,
      p_session_id: session,
      p_customer_id: sid("cus"),
    });
    // Checkout with a trial: nothing to pay now.
    await serviceClient.rpc("billing_checkout_completed", {
      p: {
        session_id: session,
        subscription_id: subscriptionId,
        payment_status: "no_payment_required",
        job_id: advert.id,
        livemode: false,
      },
    });
    // Duplicated and out-of-order subscription events (the older one arrives last).
    const sync = (created: string) =>
      serviceClient.rpc("billing_sync_subscription", {
        p: {
          stripe_subscription_id: subscriptionId,
          status: "trialing",
          job_id: advert.id,
          current_period_end: freeUntil.toISOString(),
          event_created: created,
        },
      });
    const now = new Date().toISOString();
    await sync(now);
    await sync(now);
    await sync("2020-01-01T00:00:00Z");
    expect(await job(advert.id)).toMatchObject({
      status: "active",
      free_until: null,
    });
    expect((await job(advert.id)).paid_through!.getTime()).toBe(freeUntil.getTime());

    // The end passes: covered by the subscription, the advert is not suspended.
    await setFreePublicationUntil(new Date(Date.now() - 1000));
    await serviceClient.rpc("run_maintenance");
    expect(await job(advert.id)).toMatchObject({ status: "active" });
    expect(await isPublic(advert.id)).toEqual([{ id: advert.id, is_open: true }]);
  });

  it("cancelled during the trial: the advert ends with the subscription (voluntary), not as a launch-offer suspension", async () => {
    const advert = await freeAdvert(company);
    const prep = await serviceClient.rpc("billing_prepare_checkout", {
      p_actor: company.owner.id,
      p_job_id: advert.id,
    });
    const plan = (prep.data as { plan: { id: string } }).plan;
    const session = sid("cs_test");
    const subscriptionId = sid("sub");
    await serviceClient.rpc("billing_register_checkout", {
      p_job_id: advert.id,
      p_plan_id: plan.id,
      p_session_id: session,
      p_customer_id: sid("cus"),
    });
    await serviceClient.rpc("billing_checkout_completed", {
      p: {
        session_id: session,
        subscription_id: subscriptionId,
        payment_status: "no_payment_required",
        job_id: advert.id,
        livemode: false,
      },
    });
    await serviceClient.rpc("billing_sync_subscription", {
      p: {
        stripe_subscription_id: subscriptionId,
        status: "canceled",
        job_id: advert.id,
        ended_at: new Date().toISOString(),
        event_created: new Date(Date.now() + 1000).toISOString(),
      },
    });
    expect((await job(advert.id)).status).toBe("expired");
  });

  it("reminders 30 and 7 days before the end: once per company and milestone", async () => {
    await freeAdvert(company);
    await setFreePublicationUntil(new Date(Date.now() + 20 * 24 * HOUR));
    await serviceClient.rpc("run_maintenance");
    await serviceClient.rpc("run_maintenance");
    expect(await outbox("free_period_ending", company.companyId)).toBe(1);
    await setFreePublicationUntil(new Date(Date.now() + 3 * 24 * HOUR));
    await serviceClient.rpc("run_maintenance");
    await serviceClient.rpc("run_maintenance");
    expect(await outbox("free_period_ending", company.companyId)).toBe(2);
  });

  it("the end date and the per-advert state cannot be changed by a recruiter", async () => {
    const advert = await freeAdvert(company);
    const forged = await company.owner.client
      .from("jobs")
      .update({ free_until: "2030-01-01T00:00:00Z" } as never)
      .eq("id", advert.id);
    expect(forged.error).not.toBeNull();
    const setting = await company.owner.client
      .from("platform_settings")
      .update({ value: "2030-01-01T00:00:00Z" } as never)
      .eq("key", "billing.free_publication_until");
    expect(setting.error ?? (setting.count === 0 ? null : setting.data)).toBeDefined();
    const [s] = await sql<{ v: string }>(`select value #>> '{}' as v from public.platform_settings where key = 'billing.free_publication_until'`);
    expect(s.v).not.toContain("2030");
  });
});
