/**
 * Anonymous applications ("le talent avant les préjugés"): what recruiters can see
 * before and after the candidate agrees to disclose their identity, and every way
 * around it (direct table access, files, history, aliases, status changes).
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  activateJob,
  createCompany,
  createDraftJob,
  createReadyCandidate,
  resetRateLimits,
  serviceClient,
  sql,
  type TestCompany,
} from "../../helpers/supabase";

type Candidate = Awaited<ReturnType<typeof createReadyCandidate>>;
type RecruiterView = {
  alias: string;
  status: string;
  profile: Record<string, unknown>;
  identity: Record<string, string> | null;
  history: Record<string, unknown>[];
  reveal: { status: string; can_request: boolean; next_request_at: string | null };
  resume: { available: boolean; downloadable: boolean; anonymized_status: string; anonymized_text: string | null };
};

/** Candidate whose profile is full of personal data, including in free text. */
async function candidateWithPersonalData(): Promise<Candidate> {
  const cand = await createReadyCandidate(); // Amel Durand, Lyon
  const upd = await cand.client
    .from("candidate_profiles")
    .update({
      phone: "+33 6 12 34 56 78",
      city: "Villeurbanne",
      region_code: null,
      headline: "Amel Durand — Développeuse React",
      summary: "Bonjour, je suis Amel DURAND. Écrivez-moi : amel.durand@gmail.com ou au 06 12 34 56 78. Portfolio https://ameldurand.dev, linkedin.com/in/amel-durand",
      years_of_experience: 6,
      skills: ["React", "TypeScript", "Accessibilité"],
    })
    .eq("user_id", cand.id);
  if (upd.error) throw upd.error;
  const exp = await cand.client.from("candidate_experiences").insert({
    user_id: cand.id,
    title: "Développeuse front-end",
    company_name: "Durandal Conseil",
    location: "Lyon",
    start_date: "2019-01-01",
    is_current: true,
    description: "Interfaces accessibles. Contact référent : amel.durand@gmail.com",
  });
  if (exp.error) throw exp.error;
  const edu = await cand.client.from("candidate_educations").insert({
    user_id: cand.id,
    degree: "Master informatique",
    school: "Université Lyon 1",
    start_date: "2012-09-01",
    end_date: "2014-06-30",
  });
  if (edu.error) throw edu.error;
  return cand;
}

describe("anonymous applications", () => {
  let company: TestCompany;
  let otherCompany: TestCompany;
  let job: { id: string };
  let job2: { id: string };
  let cand: Candidate;
  let appId: string;
  let app2Id: string;

  const view = async (id = appId) => {
    const r = await company.owner.client.rpc("recruiter_get_application", { p_application_id: id });
    expect(r.error).toBeNull();
    return r.data as unknown as RecruiterView;
  };

  beforeAll(async () => {
    await resetRateLimits();
    [company, otherCompany, cand] = await Promise.all([createCompany(), createCompany(), candidateWithPersonalData()]);
    job = await createDraftJob(company);
    job2 = await createDraftJob(company, { title: "Intégratrice web accessible" });
    await activateJob(job.id);
    await activateJob(job2.id);
    const r1 = await cand.client.rpc("apply_to_job", { p_job_id: job.id });
    const r2 = await cand.client.rpc("apply_to_job", { p_job_id: job2.id });
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    appId = (r1.data as { application_id: string }).application_id;
    app2Id = (r2.data as { application_id: string }).application_id;
  });

  it("stores a professional snapshot without identity, masks free text, and keeps the identity apart", async () => {
    const [app] = await sql(`select candidate_snapshot as s, public_alias from public.applications where id = $1`, [appId]);
    const serialized = JSON.stringify(app.s);
    for (const leak of ["Amel", "DURAND", "Durand —", "gmail", "12 34 56 78", "ameldurand.dev", "linkedin", "Villeurbanne", "2014"]) {
      expect(serialized).not.toContain(leak);
    }
    expect(app.s.skills).toEqual(["React", "TypeScript", "Accessibilité"]);
    expect(app.s.experiences[0]).toMatchObject({ title: "Développeuse front-end", company_name: "Durandal Conseil" });
    expect(app.s.educations[0]).toEqual({ degree: "Master informatique", school: "Université Lyon 1", field_of_study: null, description: null });
    const [identity] = await sql(`select identity from public.application_identities where application_id = $1`, [appId]);
    expect(identity.identity).toMatchObject({ first_name: "Amel", last_name: "Durand", email: cand.email, phone: "+33 6 12 34 56 78", city: "Villeurbanne" });
  });

  it("gives each application its own alias, unrelated between two adverts", async () => {
    const rows = await sql(`select public_alias from public.applications where id = any($1::uuid[])`, [[appId, app2Id]]);
    expect(rows).toHaveLength(2);
    expect(rows[0].public_alias).not.toBe(rows[1].public_alias);
    for (const r of rows) expect(r.public_alias).toMatch(/^TJ-[2-9A-HJKMNP-TV-Z]{6}$/);
  });

  it("shows the recruiter an anonymous profile before any authorisation", async () => {
    const v = await view();
    expect(v.alias).toMatch(/^TJ-/);
    expect(v.identity).toBeNull();
    expect(v.reveal).toMatchObject({ status: "none", can_request: true });
    expect(v.resume).toMatchObject({ available: true, downloadable: false, anonymized_text: null });
    expect(JSON.stringify(v)).not.toMatch(/Amel|Durand\b|gmail|12 34 56|Villeurbanne|candidate_id|resume_version_id/);
    expect(v.history.every((h) => Object.keys(h).sort().join() === "actor,created_at,to_status")).toBe(true);
    const list = await company.owner.client.rpc("recruiter_list_applications", { p_job_id: job.id });
    expect(list.error).toBeNull();
    const row = list.data!.find((r) => r.id === appId)!;
    expect(row).toMatchObject({ identity_revealed: false, display_name: null, alias: v.alias });
    expect(row.skills).toEqual(["React", "TypeScript", "Accessibilité"]);
  });

  it("closes every direct way around the anonymity (tables, history, files, version ids)", async () => {
    const recruiter = company.owner.client;
    expect((await recruiter.from("applications").select("*").eq("id", appId)).data).toEqual([]);
    expect((await recruiter.from("application_status_history").select("*").eq("application_id", appId)).data).toEqual([]);
    const identities = await recruiter.from("application_identities" as never).select("*");
    expect(identities.error).not.toBeNull();
    expect((await recruiter.from("application_identity_reveals").select("status").eq("application_id", appId)).data).toEqual([]);
    expect((await recruiter.from("application_identity_reveals").select("*")).error).not.toBeNull(); // requested_by is never readable
    expect((await recruiter.from("candidate_resume_versions").select("*").eq("user_id", cand.id)).data).toEqual([]);
    expect((await recruiter.from("candidate_profiles").select("*").eq("user_id", cand.id)).data).toEqual([]);
    expect((await recruiter.from("users").select("*").eq("id", cand.id)).data).toEqual([]);
    const byVersion = await recruiter.rpc("authorize_resume_download", { p_version_id: cand.versionId });
    expect(byVersion.error?.code).toBe("42501");
    const byApplication = await recruiter.rpc("authorize_application_resume_download", { p_application_id: appId });
    expect(byApplication.error?.code).toBe("42501");
    const storage = await recruiter.storage.from("resumes").download(`${cand.id}/${cand.versionId}.pdf`);
    expect(storage.error).not.toBeNull();
    const signed = await recruiter.storage.from("resumes").createSignedUrl(`${cand.id}/${cand.versionId}.pdf`, 60);
    expect(signed.error).not.toBeNull();
    // The candidate cannot use the recruiter functions, and another company is refused.
    expect((await cand.client.rpc("recruiter_get_application", { p_application_id: appId })).error?.code).toBe("42501");
    expect((await otherCompany.owner.client.rpc("recruiter_request_identity", { p_application_id: appId })).error?.code).toBe("42501");
    // Nothing personal travels in the recruiters' notification e-mail.
    const outbox = await sql(`select payload from public.email_outbox where template = 'new_application' and dedupe_key like $1`, [`%${appId}%`]);
    expect(outbox.length).toBeGreaterThan(0);
    expect(JSON.stringify(outbox)).not.toMatch(/Amel|Durand|gmail|12 34/);
  });

  it("shows the anonymised CV only once the candidate approved it, and never lets personal data be approved", async () => {
    const draft = await serviceClient.rpc("resume_store_anonymized_draft", {
      p_user_id: cand.id,
      p_version_id: cand.versionId,
      p_text: "Amel Durand\nDéveloppeuse React depuis 2019 — amel@exemple.fr",
      p_summary: { name: 1 },
    });
    expect(draft.data).toBe("to_review");
    let v = await view();
    expect(v.resume.anonymized_text).toBeNull(); // not approved yet
    const [stored] = await sql(`select anonymized_text from public.candidate_resume_versions where id = $1`, [cand.versionId]);
    expect(stored.anonymized_text).toBe("[…]\nDéveloppeuse React depuis 2019 — […]"); // database mask as a safety net
    // Typing the name back in: saved masked, not approved.
    const retyped = await cand.client.rpc("resume_save_anonymized_text", {
      p_version_id: cand.versionId,
      p_text: "Développeuse React (Amel) depuis 2019",
      p_approve: true,
    });
    expect(retyped.data).toEqual({ status: "to_review", changed: true });
    const approved = await cand.client.rpc("resume_save_anonymized_text", {
      p_version_id: cand.versionId,
      p_text: "Développeuse React depuis 2019. Accessibilité, design systems.",
      p_approve: true,
    });
    expect(approved.data).toEqual({ status: "approved", changed: false });
    v = await view();
    expect(v.resume.anonymized_text).toBe("Développeuse React depuis 2019. Accessibilité, design systems.");
    // Only the owner can edit it.
    const foreign = await company.owner.client.rpc("resume_save_anonymized_text", { p_version_id: cand.versionId, p_text: "x", p_approve: true });
    expect(foreign.error?.code).toBe("42501");
  });

  it("lets the recruiter ask once, notifies the candidate, and logs the request", async () => {
    const first = await company.owner.client.rpc("recruiter_request_identity", { p_application_id: appId });
    expect(first.data).toBe("requested");
    const again = await company.owner.client.rpc("recruiter_request_identity", { p_application_id: appId });
    expect(again.data).toBe("already_pending");
    expect((await view()).reveal).toMatchObject({ status: "pending", can_request: false });
    const mail = await sql(`select to_email, payload from public.email_outbox where template = 'identity_reveal_requested' and user_id = $1`, [cand.id]);
    expect(mail).toHaveLength(1);
    expect(mail[0].to_email).toBe(cand.email);
    const own = await cand.client.from("application_identity_reveals").select("status, requested_at, expires_at").eq("application_id", appId);
    expect(own.data).toHaveLength(1);
    expect(own.data![0].status).toBe("pending");
    const hidden = await cand.client.from("application_identity_reveals").select("requested_by" as never).eq("application_id", appId);
    expect(hidden.error).not.toBeNull(); // who asked is not exposed to the candidate
    const logs = await sql(`select action, actor_kind from public.data_access_logs where resource_type = 'application_identity' and resource_id = $1`, [appId]);
    expect(logs).toEqual([{ action: "reveal_request", actor_kind: "recruiter" }]);
  });

  it("discloses the identity and the original CV after acceptance, and tells the recruiter under the alias only", async () => {
    const answer = await cand.client.rpc("candidate_answer_identity_request", { p_application_id: appId, p_accept: true });
    expect(answer.data).toBe("accepted");
    const v = await view();
    expect(v.identity).toMatchObject({ first_name: "Amel", last_name: "Durand", email: cand.email, phone: "+33 6 12 34 56 78" });
    expect(v.resume.downloadable).toBe(true);
    const dl = await company.owner.client.rpc("authorize_application_resume_download", { p_application_id: appId });
    expect(dl.error).toBeNull();
    const list = await company.owner.client.rpc("recruiter_list_applications", { p_job_id: job.id });
    expect(list.data!.find((r) => r.id === appId)).toMatchObject({ identity_revealed: true, display_name: "Amel Durand" });
    // The other application of the same candidate stays anonymous: consent is per application.
    const other = await view(app2Id);
    expect(other.identity).toBeNull();
    const mails = await sql(`select payload from public.email_outbox where template = 'identity_reveal_answered' and payload ->> 'application_id' = $1`, [appId]);
    expect(mails.length).toBeGreaterThan(0);
    expect(mails[0].payload).toMatchObject({ outcome: "accepted", alias: v.alias });
    expect(JSON.stringify(mails)).not.toMatch(/Amel|Durand|gmail/);
    const logs = await sql(`select action from public.data_access_logs where resource_type = 'application_identity' and resource_id = $1 order by id`, [appId]);
    expect(logs.map((l) => l.action)).toEqual(["reveal_request", "reveal_accept", "view"]);
  });

  it("revokes future access when the status changes or the candidate withdraws consent", async () => {
    // Rejection: no more identity, no more CV.
    expect((await company.owner.client.rpc("recruiter_set_application_status", { p_application_id: appId, p_status: "rejected" })).error).toBeNull();
    let v = await view();
    expect(v.identity).toBeNull();
    expect(v.resume.downloadable).toBe(false);
    expect(v.reveal.can_request).toBe(false);
    expect((await company.owner.client.rpc("authorize_application_resume_download", { p_application_id: appId })).error?.code).toBe("42501");
    expect((await company.owner.client.rpc("recruiter_request_identity", { p_application_id: appId })).error?.message).toBe("application_rejected");
    // Back in the process: the consent given for this application applies again.
    expect((await company.owner.client.rpc("recruiter_set_application_status", { p_application_id: appId, p_status: "shortlisted" })).error).toBeNull();
    expect((await view()).identity).not.toBeNull();
    // The candidate withdraws access: hidden again, and no immediate new request.
    expect((await cand.client.rpc("candidate_revoke_identity_access", { p_application_id: appId })).error).toBeNull();
    v = await view();
    expect(v.identity).toBeNull();
    expect(v.reveal.status).toBe("revoked");
    expect(v.reveal.next_request_at).not.toBeNull();
    expect((await company.owner.client.rpc("recruiter_request_identity", { p_application_id: appId })).error?.message).toBe("request_cooldown");
    expect((await cand.client.rpc("candidate_revoke_identity_access", { p_application_id: appId })).error?.message).toBe("nothing_to_revoke");
  });

  it("a refusal keeps the application in progress and anonymous", async () => {
    const r = await company.owner.client.rpc("recruiter_request_identity", { p_application_id: app2Id });
    expect(r.data).toBe("requested");
    const [before] = await sql(`select status from public.applications where id = $1`, [app2Id]);
    expect((await cand.client.rpc("candidate_answer_identity_request", { p_application_id: app2Id, p_accept: false })).data).toBe("refused");
    const [after] = await sql(`select status from public.applications where id = $1`, [app2Id]);
    expect(after.status).toBe(before.status); // never an automatic rejection
    const v = await view(app2Id);
    expect(v.identity).toBeNull();
    expect(v.reveal).toMatchObject({ status: "refused", can_request: false });
    expect((await cand.client.rpc("candidate_answer_identity_request", { p_application_id: app2Id, p_accept: true })).error?.message).toBe("no_pending_request");
    // The recruiter can still shortlist on skills alone.
    expect((await company.owner.client.rpc("recruiter_set_application_status", { p_application_id: app2Id, p_status: "shortlisted" })).error).toBeNull();
  });

  it("expires unanswered requests and lets the recruiter ask again", async () => {
    const cand2 = await createReadyCandidate();
    const res = await cand2.client.rpc("apply_to_job", { p_job_id: job.id });
    const id = (res.data as { application_id: string }).application_id;
    expect((await company.owner.client.rpc("recruiter_request_identity", { p_application_id: id })).data).toBe("requested");
    await sql(`update public.application_identity_reveals set expires_at = now() - interval '1 minute' where application_id = $1`, [id]);
    expect((await view(id)).reveal.status).toBe("expired");
    expect((await cand2.client.rpc("candidate_answer_identity_request", { p_application_id: id, p_accept: true })).error?.message).toBe("request_expired");
    expect((await serviceClient.rpc("expire_identity_requests")).data).toBeGreaterThanOrEqual(1);
    expect((await company.owner.client.rpc("recruiter_request_identity", { p_application_id: id })).data).toBe("requested");
  });

  it("withdrawal, retention and account deletion end the access and erase the identity copy", async () => {
    const cand3 = await createReadyCandidate();
    const res = await cand3.client.rpc("apply_to_job", { p_job_id: job.id });
    const id = (res.data as { application_id: string }).application_id;
    await company.owner.client.rpc("recruiter_request_identity", { p_application_id: id });
    await cand3.client.rpc("candidate_answer_identity_request", { p_application_id: id, p_accept: true });
    expect((await view(id)).identity).not.toBeNull();
    expect((await cand3.client.rpc("withdraw_application", { p_application_id: id })).error).toBeNull();
    expect((await company.owner.client.rpc("recruiter_get_application", { p_application_id: id })).error?.code).toBe("42501");
    // Retention anonymisation (scheduled job) deletes the identity copy.
    await sql(`update public.applications set anonymized_at = now(), candidate_snapshot = '{"anonymized": true}' where id = $1`, [id]);
    expect(await sql(`select 1 from public.application_identities where application_id = $1`, [id])).toEqual([]);
    expect(await sql(`select status from public.application_identity_reveals where application_id = $1`, [id])).toEqual([{ status: "accepted" }]);
  });

  it("includes the alias, the identity copy and the disclosure history in the candidate's data export", async () => {
    const exp = await cand.client.rpc("export_my_data");
    expect(exp.error).toBeNull();
    const apps = (exp.data as { applications: Record<string, unknown>[] }).applications;
    const a = apps.find((x) => x.id === appId)!;
    expect(a.alias).toMatch(/^TJ-/);
    expect(a.identity_disclosed_on_acceptance).toMatchObject({ first_name: "Amel" });
    expect((a.identity_requests as { status: string }[]).map((r) => r.status)).toEqual(["revoked"]);
    const log = (exp.data as { data_access_log: { resource_type: string; action: string }[] }).data_access_log;
    expect(log.some((l) => l.resource_type === "application_identity" && l.action === "reveal_accept")).toBe(true);
  });
});
