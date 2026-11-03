/**
 * One-click application: the core feature. Atomicity, idempotency, guards,
 * recruiter visibility, status history, notifications.
 */
import { describe, expect, it, beforeAll } from "vitest";
import {
  activateJob,
  createCompany,
  createDraftJob,
  createReadyCandidate,
  createTestUser,
  sql,
  type TestCompany,
} from "../../helpers/supabase";

describe("apply_to_job (one-click application)", () => {
  let company: TestCompany;
  let job: { id: string };

  beforeAll(async () => {
    company = await createCompany();
    job = await createDraftJob(company);
    await activateJob(job.id);
  });

  it("creates the application atomically with the exact CV version and a snapshot", async () => {
    const cand = await createReadyCandidate();
    const res = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ result: "created" });
    const appId = (res.data as { application_id: string }).application_id;
    const [app] = await sql(`select * from public.applications where id = $1`, [appId]);
    expect(app.resume_version_id).toBe(cand.versionId);
    expect(app.status).toBe("submitted");
    expect(app.candidate_snapshot.email).toBe(cand.email);
    expect(app.candidate_snapshot.skills).toEqual(["React", "TypeScript"]);
    const history = await sql(`select to_status, actor from public.application_status_history where application_id = $1`, [appId]);
    expect(history).toEqual([{ to_status: "submitted", actor: "candidate" }]);
    const outbox = await sql(`select template from public.email_outbox where dedupe_key like $1 order by template`, [`%${appId}%`]);
    expect(outbox.map((o) => o.template)).toEqual(["application_submitted", "new_application"]);
  });

  it("is idempotent: a second click returns the existing application", async () => {
    const cand = await createReadyCandidate();
    const first = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    const second = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    expect(second.data).toMatchObject({ result: "already_applied" });
    expect((second.data as { application_id: string }).application_id).toBe(
      (first.data as { application_id: string }).application_id,
    );
  });

  it("prevents duplicates under concurrent double clicks", async () => {
    const cand = await createReadyCandidate();
    const results = await Promise.all(Array.from({ length: 8 }, () => cand.client.rpc("apply_to_job", { p_job_id: job.id })));
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(results.filter((r) => (r.data as { result: string }).result === "created")).toHaveLength(1);
    const rows = await sql(`select count(*)::int as n from public.applications where job_id = $1 and candidate_id = $2`, [job.id, cand.id]);
    expect(rows[0].n).toBe(1);
  });

  it("refuses incomplete profiles and missing CVs", async () => {
    const cand = await createTestUser("candidate");
    const res = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    expect(res.error?.message).toBe("profile_incomplete");
    expect(res.error?.details).toContain("resume");
  });

  it("requires the transmission consent before the first application", async () => {
    const cand = await createReadyCandidate();
    await sql(`update public.candidate_profiles set transmission_consent_at = null where user_id = $1`, [cand.id]);
    const res = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    expect(res.error?.message).toBe("consent_required");
    const wrongVersion = await cand.client.rpc("give_transmission_consent", { p_version: "1999-01-01" });
    expect(wrongVersion.error?.message).toBe("consent_version_mismatch");
  });

  it("refuses employers and closed or unpaid adverts", async () => {
    const cand = await createReadyCandidate();
    const employerAttempt = await company.owner.client.rpc("apply_to_job", { p_job_id: job.id });
    expect(employerAttempt.error?.message).toBe("not_candidate");
    const draft = await createDraftJob(company);
    const notOpen = await cand.client.rpc("apply_to_job", { p_job_id: draft.id });
    expect(notOpen.error?.message).toBe("job_not_open");
    const pastDeadline = await createDraftJob(company);
    await activateJob(pastDeadline.id);
    await sql(`update public.jobs set application_deadline = current_date - 1 where id = $1`, [pastDeadline.id]);
    const late = await cand.client.rpc("apply_to_job", { p_job_id: pastDeadline.id });
    expect(late.error?.message).toBe("job_not_open");
  });

  it("enforces the daily application quota", async () => {
    const cand = await createReadyCandidate();
    await sql(`update public.platform_settings set value = '1' where key = 'applications.daily_limit'`);
    try {
      const j1 = await createDraftJob(company);
      const j2 = await createDraftJob(company);
      await activateJob(j1.id);
      await activateJob(j2.id);
      expect((await cand.client.rpc("apply_to_job", { p_job_id: j1.id })).error).toBeNull();
      expect((await cand.client.rpc("apply_to_job", { p_job_id: j2.id })).error?.message).toBe("rate_limited");
    } finally {
      await sql(`update public.platform_settings set value = '60' where key = 'applications.daily_limit'`);
    }
  });

  it("marks 'viewed' only when the recruiter opens the application, and records history", async () => {
    const cand = await createReadyCandidate();
    const res = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    const appId = (res.data as { application_id: string }).application_id;
    let [app] = await sql(`select status, first_viewed_at from public.applications where id = $1`, [appId]);
    expect(app).toMatchObject({ status: "submitted", first_viewed_at: null });

    // Listing applications does not mark them as viewed.
    await company.owner.client.from("applications").select("id").eq("job_id", job.id);
    [app] = await sql(`select status from public.applications where id = $1`, [appId]);
    expect(app.status).toBe("submitted");

    expect((await company.owner.client.rpc("recruiter_mark_viewed", { p_application_id: appId })).error).toBeNull();
    [app] = await sql(`select status, first_viewed_at from public.applications where id = $1`, [appId]);
    expect(app.status).toBe("viewed");
    expect(app.first_viewed_at).not.toBeNull();

    expect(
      (await company.owner.client.rpc("recruiter_set_application_status", { p_application_id: appId, p_status: "shortlisted" })).error,
    ).toBeNull();
    const invalid = await company.owner.client.rpc("recruiter_set_application_status", {
      p_application_id: appId,
      p_status: "withdrawn",
    });
    expect(invalid.error?.message).toBe("invalid_status");
    const candidateView = await cand.client.from("applications").select("status").eq("id", appId).single();
    expect(candidateView.data?.status).toBe("shortlisted");
    const history = await cand.client.from("application_status_history").select("to_status").eq("application_id", appId).order("id");
    expect(history.data?.map((h) => h.to_status)).toEqual(["submitted", "viewed", "shortlisted"]);
  });

  it("withdrawal hides the application and the CV from the recruiter", async () => {
    const cand = await createReadyCandidate();
    const res = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    const appId = (res.data as { application_id: string }).application_id;
    expect((await cand.client.rpc("withdraw_application", { p_application_id: appId })).error).toBeNull();
    const recruiterView = await company.owner.client.from("applications").select("id").eq("id", appId);
    expect(recruiterView.data).toEqual([]);
    const download = await company.owner.client.rpc("authorize_resume_download", { p_version_id: cand.versionId });
    expect(download.error?.code).toBe("42501");
  });

  it("closing the advert closes new applications and updates open ones", async () => {
    const localJob = await createDraftJob(company);
    await activateJob(localJob.id);
    const cand = await createReadyCandidate();
    const res = await cand.client.rpc("apply_to_job", { p_job_id: localJob.id });
    const appId = (res.data as { application_id: string }).application_id;
    const close = await company.owner.client.rpc("close_job", { p_job_id: localJob.id });
    expect(close.error).toBeNull();
    const [app] = await sql(`select status from public.applications where id = $1`, [appId]);
    expect(app.status).toBe("job_closed");
    const late = await (await createReadyCandidate()).client.rpc("apply_to_job", { p_job_id: localJob.id });
    expect(late.error?.message).toBe("job_not_open");
  });
});
