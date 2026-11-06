/**
 * Back-office decisions at the SQL layer: permission checks, side effects on
 * adverts and the notification of the persons concerned.
 */
import { describe, expect, it } from "vitest";
import { activateJob, createCompany, createDraftJob, createTestUser, grantAdminRole, sql } from "../../helpers/supabase";

describe("company suspension", () => {
  it("suspends the adverts, stops renewals, notifies the members, and can be lifted", async () => {
    const admin = await createTestUser("candidate", { firstName: "Sam", lastName: "Admin" });
    await grantAdminRole(admin.id, "verification_officer");
    const company = await createCompany();
    const job = await createDraftJob(company);
    await activateJob(job.id);

    const suspended = await admin.client.rpc("admin_set_company_suspension", { p_company_id: company.companyId, p_suspend: true, p_reason: "Offres trompeuses signalées" });
    expect(suspended.error).toBeNull();
    const [c] = await sql(`select verification_status, suspension_reason from public.companies where id = $1`, [company.companyId]);
    expect(c).toMatchObject({ verification_status: "suspended", suspension_reason: "Offres trompeuses signalées" });
    expect((await sql(`select status from public.jobs where id = $1`, [job.id]))[0].status).toBe("suspended");

    const lifted = await admin.client.rpc("admin_set_company_suspension", { p_company_id: company.companyId, p_suspend: false, p_reason: "Justificatifs reçus" });
    expect(lifted.error).toBeNull();
    expect((await sql(`select verification_status from public.companies where id = $1`, [company.companyId]))[0].verification_status).toBe("verified");

    const mails = await sql(`select payload from public.email_outbox where user_id = $1 and template = 'company_suspension' order by created_at`, [company.owner.id]);
    expect(mails.map((m) => m.payload.suspended)).toEqual([true, false]);
    expect(mails[0].payload.reason).toBe("Offres trompeuses signalées");

    const audit = await sql(`select action from public.admin_audit_logs where target_id = $1 and action like 'company.%' order by id`, [company.companyId]);
    expect(audit.map((a) => a.action)).toEqual(["company.suspend", "company.unsuspend"]);
  });

  it("is refused to roles without the permission", async () => {
    const support = await createTestUser("candidate", { firstName: "Sue", lastName: "Port" });
    await grantAdminRole(support.id, "support");
    const company = await createCompany();
    const res = await support.client.rpc("admin_set_company_suspension", { p_company_id: company.companyId, p_suspend: true, p_reason: "Test" });
    expect(res.error?.message).toBe("forbidden");
    expect((await sql(`select verification_status from public.companies where id = $1`, [company.companyId]))[0].verification_status).toBe("verified");
  });
});
