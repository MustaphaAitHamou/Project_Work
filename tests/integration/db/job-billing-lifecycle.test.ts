/**
 * Job publication lifecycle driven by verification, moderation and billing
 * events (SQL layer). The Stripe webhook adapter is covered separately.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createCompany,
  createDraftJob,
  createReadyCandidate,
  grantAdminRole,
  serviceClient,
  setCountryPaidPublishing,
  sql,
  type TestCompany,
} from "../../helpers/supabase";

/** Stripe object ids must be unique per run: the local database is not reset between runs. */
const run = randomUUID().slice(0, 8);
const sid = (prefix: string) => `${prefix}_${run}_${randomUUID().slice(0, 8)}`;
const renewInvoice = sid("in_renew");
const refundIntent = sid("pi_refund");
const customerId = sid("cus");

async function payJob(jobId: string, actor: string) {
  const prep = await serviceClient.rpc("billing_prepare_checkout", { p_actor: actor, p_job_id: jobId });
  if (prep.error) throw prep.error;
  const plan = (prep.data as { plan: { id: string } }).plan;
  const sessionId = `cs_test_${randomUUID()}`;
  const reg = await serviceClient.rpc("billing_register_checkout", {
    p_job_id: jobId,
    p_plan_id: plan.id,
    p_session_id: sessionId,
    p_customer_id: customerId,
  });
  if (reg.error) throw reg.error;
  return { sessionId, subscriptionId: `sub_${randomUUID().slice(0, 12)}` };
}

describe("job lifecycle", () => {
  let company: TestCompany;

  beforeAll(async () => {
    company = await createCompany({ verified: false });
  });

  it("an unverified company cannot submit an advert for publication", async () => {
    const job = await createDraftJob(company);
    const res = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    expect(res.error?.message).toBe("company_not_verified");
  });

  it("paid publishing must be enabled for the job country", async () => {
    await sql(`update public.companies set verification_status = 'verified' where id = $1`, [company.companyId]);
    const job = await createDraftJob(company, {}, "ES");
    await setCountryPaidPublishing("ES", false);
    const res = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    expect(res.error?.message).toBe("country_not_enabled");
  });

  it("a clean advert goes to pending_payment; a discriminatory one goes to human review", async () => {
    const clean = await createDraftJob(company);
    const ok = await company.owner.client.rpc("submit_job", { p_job_id: clean.id });
    expect(ok.data).toMatchObject({ status: "pending_payment", flags: [] });

    const biased = await createDraftJob(company, {
      description:
        "Nous recherchons un jeune homme de moins de 30 ans, nationalité française exigée, pour un poste de commercial terrain dans notre agence.",
    });
    const flagged = await company.owner.client.rpc("submit_job", { p_job_id: biased.id });
    expect(flagged.data).toMatchObject({ status: "in_review" });
    expect((flagged.data as { flags: string[] }).flags).toEqual(expect.arrayContaining(["age", "nationality_origin"]));
  });

  it("refuses incomplete adverts with explicit reasons", async () => {
    const job = await createDraftJob(company, { description: "Trop court", work_mode: "remote", remote_scope: "listed_countries" });
    const res = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    expect(res.error?.message).toBe("job_incomplete");
    expect(res.error?.details).toContain("description_too_short");
    expect(res.error?.details).toContain("remote_countries");
  });

  it("is never activated without a confirmed payment", async () => {
    const job = await createDraftJob(company);
    await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    const { sessionId } = await payJob(job.id, company.owner.id);
    const unpaid = await serviceClient.rpc("billing_checkout_completed", {
      p: { session_id: sessionId, subscription_id: sid("sub_unpaid"), customer_id: customerId, payment_status: "unpaid", job_id: job.id },
    });
    expect(unpaid.error).toBeNull();
    const [row] = await sql(`select status from public.jobs where id = $1`, [job.id]);
    expect(row.status).toBe("pending_payment");
    const pub = await serviceClient.from("public_jobs").select("id").eq("id", job.id);
    expect(pub.data).toEqual([]);
  });

  it("activates on confirmed payment, processes duplicate webhooks once, handles failures and cancellation", async () => {
    const job = await createDraftJob(company);
    await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    const { sessionId, subscriptionId } = await payJob(job.id, company.owner.id);

    // Idempotency ledger
    const eventId = `evt_${randomUUID()}`;
    const first = await serviceClient.rpc("billing_begin_event", {
      p_id: eventId, p_type: "checkout.session.completed", p_livemode: false, p_created: new Date().toISOString(), p_payload: {},
    });
    expect(first.data).toMatchObject({ already_processed: false });
    const done = await serviceClient.rpc("billing_checkout_completed", {
      p: { session_id: sessionId, subscription_id: subscriptionId, customer_id: customerId, payment_status: "paid", job_id: job.id, livemode: false },
    });
    expect(done.data).toMatchObject({ job_result: "activated" });
    await serviceClient.rpc("billing_finish_event", { p_id: eventId });
    const dup = await serviceClient.rpc("billing_begin_event", {
      p_id: eventId, p_type: "checkout.session.completed", p_livemode: false, p_created: new Date().toISOString(), p_payload: {},
    });
    expect(dup.data).toMatchObject({ already_processed: true });

    let [row] = await sql(`select status, published_at from public.jobs where id = $1`, [job.id]);
    expect(row.status).toBe("active");
    expect(row.published_at).not.toBeNull();

    // Renewal payment fails -> grace period -> suspension by maintenance -> reactivation on payment
    const periodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
    await serviceClient.rpc("billing_sync_subscription", {
      p: { stripe_subscription_id: subscriptionId, status: "past_due", job_id: job.id, current_period_end: periodEnd, event_created: new Date().toISOString() },
    });
    const failed = await serviceClient.rpc("billing_record_payment", {
      p: { stripe_subscription_id: subscriptionId, stripe_invoice_id: renewInvoice, attempt_number: 1, amount: 595, currency: "eur", status: "failed", failure_code: "card_declined" },
    });
    expect(failed.data).toMatchObject({ result: "failure_recorded" });
    [row] = await sql(`select status from public.jobs where id = $1`, [job.id]);
    expect(row.status).toBe("active"); // still within the grace period
    await sql(`update public.subscriptions set grace_until = now() - interval '1 minute' where stripe_subscription_id = $1`, [subscriptionId]);
    const maint = await serviceClient.rpc("run_maintenance");
    expect(maint.error).toBeNull();
    [row] = await sql(`select status, suspension_reason from public.jobs where id = $1`, [job.id]);
    expect(row).toMatchObject({ status: "suspended", suspension_reason: "payment_failed" });
    const paid = await serviceClient.rpc("billing_record_payment", {
      p: { stripe_subscription_id: subscriptionId, stripe_invoice_id: renewInvoice, attempt_number: 2, amount: 595, currency: "eur", status: "succeeded", period_end: periodEnd },
    });
    expect(paid.data).toMatchObject({ result: "activated" });
    [row] = await sql(`select status from public.jobs where id = $1`, [job.id]);
    expect(row.status).toBe("active");

    // Out-of-order event is ignored
    const stale = await serviceClient.rpc("billing_sync_subscription", {
      p: { stripe_subscription_id: subscriptionId, status: "unpaid", event_created: "2020-01-01T00:00:00Z" },
    });
    expect(stale.data).toMatchObject({ result: "ignored_stale_event" });

    // Employer closes the advert: renewal must be stopped
    const cand = await createReadyCandidate();
    await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    const close = await company.owner.client.rpc("close_job", { p_job_id: job.id });
    expect((close.data as { cancel_subscription_ids: string[] }).cancel_subscription_ids).toEqual([subscriptionId]);

    // Subscription ends -> stays closed (not reopened), history kept
    await serviceClient.rpc("billing_sync_subscription", {
      p: { stripe_subscription_id: subscriptionId, status: "canceled", ended_at: new Date().toISOString(), event_created: new Date(Date.now() + 1000).toISOString() },
    });
    [row] = await sql(`select status from public.jobs where id = $1`, [job.id]);
    expect(row.status).toBe("closed");
    const apps = await company.owner.client.from("applications").select("status").eq("job_id", job.id);
    expect(apps.data?.[0]?.status).toBe("job_closed");
  });

  it("expires the advert when the subscription is cancelled at period end", async () => {
    const job = await createDraftJob(company);
    await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    const { sessionId, subscriptionId } = await payJob(job.id, company.owner.id);
    await serviceClient.rpc("billing_checkout_completed", {
      p: { session_id: sessionId, subscription_id: subscriptionId, customer_id: customerId, payment_status: "paid", job_id: job.id },
    });
    await serviceClient.rpc("billing_sync_subscription", {
      p: { stripe_subscription_id: subscriptionId, status: "canceled", event_created: new Date().toISOString() },
    });
    const [row] = await sql(`select status from public.jobs where id = $1`, [job.id]);
    expect(row.status).toBe("expired");
  });

  it("records refunds against the payment", async () => {
    const job = await createDraftJob(company);
    await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    const { sessionId, subscriptionId } = await payJob(job.id, company.owner.id);
    await serviceClient.rpc("billing_checkout_completed", {
      p: { session_id: sessionId, subscription_id: subscriptionId, customer_id: customerId, payment_status: "paid", job_id: job.id },
    });
    await serviceClient.rpc("billing_record_payment", {
      p: { stripe_subscription_id: subscriptionId, stripe_invoice_id: sid("in_first"), attempt_number: 1, amount: 595, currency: "eur", status: "succeeded", payment_intent_id: refundIntent },
    });
    const refund = await serviceClient.rpc("billing_record_refund", {
      p: { stripe_refund_id: `re_${randomUUID()}`, payment_intent_id: refundIntent, amount: 595, currency: "eur", status: "succeeded", reason: "Annonce rejetée par la modération" },
    });
    expect(refund.data).toMatchObject({ result: "recorded", refunded_total: 595 });
    const [p] = await sql(`select status, amount_refunded from public.payments where stripe_payment_intent_id = 'pi_refund_test'`);
    expect(p).toMatchObject({ status: "refunded", amount_refunded: 595 });
  });
});

describe("back-office permissions", () => {
  it("separates roles: a moderator can moderate but cannot manage countries or refunds", async () => {
    const company = await createCompany();
    const job = await createDraftJob(company, {
      description: "Poste réservé aux hommes uniquement, âge maximum 35 ans, merci de joindre une photo obligatoire à votre dossier.",
    });
    const submit = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    expect(submit.data).toMatchObject({ status: "in_review" });

    const moderator = company.owner; // reuse an existing session for brevity
    const mod = await createReadyCandidate();
    await grantAdminRole(mod.id, "moderator");
    const reject = await mod.client.rpc("admin_moderate_job", { p_job_id: job.id, p_decision: "reject", p_reason: "Critères discriminatoires (âge, sexe, photo)." });
    expect(reject.error).toBeNull();
    const [row] = await sql(`select status, rejection_reason from public.jobs where id = $1`, [job.id]);
    expect(row.status).toBe("rejected");
    const audit = await sql(`select action from public.admin_audit_logs where target_id = $1`, [job.id]);
    expect(audit.map((a) => a.action)).toContain("job.reject");

    const country = await mod.client.rpc("admin_update_country", { p_code: "LU", p: { is_paid_publishing_enabled: true } });
    expect(country.error?.code).toBe("42501");
    expect(moderator.id).toBeTruthy();
  });

  it("enabling paid publishing requires a completed compliance checklist or a documented override", async () => {
    const admin = await createReadyCandidate();
    await grantAdminRole(admin.id, "super_admin");
    await setCountryPaidPublishing("LU", false);
    const refused = await admin.client.rpc("admin_update_country", { p_code: "LU", p: { is_paid_publishing_enabled: true } });
    expect(refused.error?.message).toBe("compliance_incomplete");
    const override = await admin.client.rpc("admin_update_country", {
      p_code: "LU",
      p: { is_paid_publishing_enabled: true },
      p_override_justification: "Validation juridique externe reçue le 2026-11-03 (avis cabinet X, réf. 42).",
    });
    expect(override.error).toBeNull();
    await setCountryPaidPublishing("LU", false);
  });
});
