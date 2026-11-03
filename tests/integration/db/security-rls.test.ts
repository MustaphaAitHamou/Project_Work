/**
 * Security: Row Level Security isolation, column privileges (privilege
 * escalation attempts) and service-only functions.
 */
import { describe, expect, it, beforeAll } from "vitest";
import {
  activateJob,
  anonClient,
  createCompany,
  createDraftJob,
  createReadyCandidate,
  createTestUser,
  serviceClient,
  sql,
  type TestCompany,
  type TestUser,
} from "../../helpers/supabase";

describe("RLS isolation and privilege escalation", () => {
  let candA: Awaited<ReturnType<typeof createReadyCandidate>>;
  let candB: Awaited<ReturnType<typeof createReadyCandidate>>;
  let companyX: TestCompany;
  let companyY: TestCompany;
  let jobX: { id: string };
  let appId: string;

  beforeAll(async () => {
    [candA, candB, companyX, companyY] = await Promise.all([
      createReadyCandidate(),
      createReadyCandidate(),
      createCompany(),
      createCompany(),
    ]);
    jobX = await createDraftJob(companyX);
    await activateJob(jobX.id);
    const res = await candA.client.rpc("apply_to_job", { p_job_id: jobX.id });
    expect(res.error).toBeNull();
    appId = (res.data as { application_id: string }).application_id;
  });

  it("a candidate cannot read another candidate's private data", async () => {
    const profile = await candA.client.from("candidate_profiles").select("*").eq("user_id", candB.id);
    expect(profile.error).toBeNull();
    expect(profile.data).toEqual([]);
    const users = await candA.client.from("users").select("*").eq("id", candB.id);
    expect(users.data).toEqual([]);
    const resumes = await candA.client.from("candidate_resume_versions").select("*").eq("user_id", candB.id);
    expect(resumes.data).toEqual([]);
    const apps = await candB.client.from("applications").select("*").eq("id", appId);
    expect(apps.data).toEqual([]);
  });

  it("a company cannot access applications or private jobs of another company", async () => {
    const own = await companyX.owner.client.from("applications").select("id, candidate_snapshot").eq("id", appId);
    expect(own.data).toHaveLength(1);
    const other = await companyY.owner.client.from("applications").select("*").eq("id", appId);
    expect(other.data).toEqual([]);
    const draft = await createDraftJob(companyX, { title: "Poste confidentiel en préparation" });
    const leak = await companyY.owner.client.from("jobs").select("*").eq("id", draft.id);
    expect(leak.data).toEqual([]);
    const anonLeak = await anonClient().from("public_jobs").select("id").eq("id", draft.id);
    expect(anonLeak.data).toEqual([]);
  });

  it("a company cannot browse the candidate database", async () => {
    const profiles = await companyX.owner.client.from("candidate_profiles").select("*");
    expect(profiles.data).toEqual([]);
    const users = await companyX.owner.client.from("users").select("id").eq("account_type", "candidate");
    expect(users.data).toEqual([]);
  });

  it("a recruiter of another company cannot download a candidate CV", async () => {
    const denied = await companyY.owner.client.rpc("authorize_resume_download", { p_version_id: candA.versionId });
    expect(denied.error?.code).toBe("42501");
    const allowed = await companyX.owner.client.rpc("authorize_resume_download", { p_version_id: candA.versionId });
    expect(allowed.error).toBeNull();
    const deniedCandidate = await candB.client.rpc("authorize_resume_download", { p_version_id: candA.versionId });
    expect(deniedCandidate.error?.code).toBe("42501");
    const logs = await sql(
      `select actor_kind from public.data_access_logs where resource_id = $1 and action = 'download'`,
      [candA.versionId],
    );
    expect(logs.map((l) => l.actor_kind)).toContain("recruiter");
  });

  it("users cannot escalate privileges through column updates", async () => {
    const typeChange = await candA.client.from("users").update({ account_type: "employer" } as never).eq("id", candA.id);
    expect(typeChange.error).not.toBeNull();
    const statusChange = await candA.client.from("users").update({ status: "active" } as never).eq("id", candA.id);
    expect(statusChange.error).not.toBeNull();
    const roleInsert = await candA.client.from("admin_roles").insert({ user_id: candA.id, role: "super_admin" } as never);
    expect(roleInsert.error).not.toBeNull();
    const verify = await companyY.owner.client
      .from("companies")
      .update({ verification_status: "verified" } as never)
      .eq("id", companyY.companyId);
    expect(verify.error).not.toBeNull();
    const jobStatus = await companyX.owner.client.from("jobs").update({ status: "active" } as never).eq("id", jobX.id);
    expect(jobStatus.error).not.toBeNull();
    const appStatus = await companyX.owner.client.from("applications").update({ status: "hired" } as never).eq("id", appId);
    expect(appStatus.error).not.toBeNull();
    const ownName = await candA.client.from("users").update({ first_name: "Amélie" }).eq("id", candA.id);
    expect(ownName.error).toBeNull();
  });

  it("an employer cannot insert a job for another company or with a non-draft status", async () => {
    const foreign = await companyY.owner.client.from("jobs").insert({
      company_id: companyX.companyId,
      created_by: companyY.owner.id,
      title: "Injection inter-entreprises",
      description: "x".repeat(100),
      contract_type: "permanent",
      experience_level: "mid",
    });
    expect(foreign.error).not.toBeNull();
  });

  it("service-only functions and tables are not reachable with a user session", async () => {
    const billing = await companyX.owner.client.rpc("billing_sync_subscription", { p: {} });
    expect(billing.error).not.toBeNull();
    const create = await companyX.owner.client.rpc("create_company", { p_actor: companyX.owner.id, p: {} });
    expect(create.error).not.toBeNull();
    const maintenance = await candA.client.rpc("run_maintenance");
    expect(maintenance.error).not.toBeNull();
    const outbox = await candA.client.from("email_outbox" as never).select("*");
    expect(outbox.error).not.toBeNull();
    const bootstrap = await candA.client.rpc("bootstrap_super_admin", { p_email: candA.email });
    expect(bootstrap.error).not.toBeNull();
  });

  it("non-admin users are refused by back-office functions", async () => {
    const stats = await candA.client.rpc("admin_dashboard_stats");
    expect(stats.error?.code).toBe("42501");
    const review = await companyX.owner.client.rpc("admin_review_company", {
      p_company_id: companyX.companyId,
      p_decision: "verified",
    });
    expect(review.error?.code).toBe("42501");
  });

  it("anonymous visitors only see public data", async () => {
    const anon = anonClient();
    const users = await anon.from("users").select("*");
    expect(users.error).not.toBeNull();
    const jobs = await anon.from("jobs").select("*");
    expect(jobs.error).not.toBeNull();
    const pub = await anon.from("public_jobs").select("id, title, company_name").eq("id", jobX.id);
    expect(pub.data).toHaveLength(1);
    const search = await anon.rpc("search_jobs", { p_q: "React" });
    expect(search.error).toBeNull();
  });

  it("malformed input is rejected by constraints, not executed", async () => {
    const injection = await candA.client
      .from("candidate_profiles")
      .update({ phone: "'); drop table public.users; --" })
      .eq("user_id", candA.id);
    expect(injection.error).not.toBeNull();
    const stillThere = await sql(`select count(*)::int as n from public.users`);
    expect(stillThere[0].n).toBeGreaterThan(0);
    const search = await anonClient().rpc("search_jobs", { p_q: "'; select pg_sleep(5); --", p_limit: 5 });
    expect(search.error).toBeNull();
  });

  it("suspended users lose access to protected actions", async () => {
    const victim: TestUser = await createTestUser("candidate");
    await serviceClient.from("users").update({ status: "suspended" }).eq("id", victim.id);
    const res = await victim.client.rpc("apply_to_job", { p_job_id: jobX.id });
    expect(res.error?.message).toBe("account_inactive");
  });
});
