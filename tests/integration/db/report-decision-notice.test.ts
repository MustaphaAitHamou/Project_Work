/**
 * DSA art. 16(5): the author of a report is told of the decision (e-mail queued in the
 * outbox), in their language, without the moderator's internal note.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { activateJob, createCompany, createDraftJob, createTestUser, grantAdminRole, serviceClient, sql } from "../../helpers/supabase";

describe("report decision notice", () => {
  it("e-mails the reporter (account or address left on the form) when a report is resolved or dismissed", async () => {
    const company = await createCompany({ verified: true });
    const job = await createDraftJob(company);
    await activateJob(job.id);

    const moderator = await createTestUser("candidate", { firstName: "Mod", lastName: "Dsa" });
    await grantAdminRole(moderator.id, "moderator");
    const member = await createTestUser("candidate", { firstName: "Signale", lastName: "Compte" });
    const anonymousEmail = `signalement.${randomUUID().slice(0, 8)}@example.test`;

    const { data: rows, error } = await serviceClient
      .from("reports")
      .insert([
        { job_id: job.id, company_id: company.companyId, reporter_id: member.id, reason: "discrimination", details: "Critère d'âge" },
        { job_id: job.id, company_id: company.companyId, reporter_email: anonymousEmail, reporter_locale: "en", reason: "scam" },
      ])
      .select("id");
    expect(error).toBeNull();
    const [byMember, byVisitor] = rows!;

    const resolved = await moderator.client.rpc("admin_handle_report", { p_report_id: byMember.id, p_status: "resolved", p_note: "Note interne : annonce corrigée" });
    expect(resolved.error).toBeNull();
    const dismissed = await moderator.client.rpc("admin_handle_report", { p_report_id: byVisitor.id, p_status: "dismissed", p_note: "Note interne" });
    expect(dismissed.error).toBeNull();

    const [toMember] = await sql(`select to_email, locale, payload from public.email_outbox where template = 'report_decision' and dedupe_key = $1`, [`report_decision:${byMember.id}:resolved`]);
    expect(toMember.to_email).toBe(member.email);
    expect(toMember.payload).toMatchObject({ status: "resolved", job_title: "Développeur React / TypeScript" });
    expect(JSON.stringify(toMember.payload)).not.toContain("Note interne");

    const [toVisitor] = await sql(`select to_email, locale, payload from public.email_outbox where template = 'report_decision' and dedupe_key = $1`, [`report_decision:${byVisitor.id}:dismissed`]);
    expect(toVisitor).toMatchObject({ to_email: anonymousEmail, locale: "en" });
    expect(toVisitor.payload).toMatchObject({ status: "dismissed", reference: byVisitor.id.slice(0, 8).toUpperCase() });

    // Putting a report "in review" does not notify anyone.
    const [{ id: third }] = (await serviceClient.from("reports").insert({ job_id: job.id, company_id: company.companyId, reporter_email: anonymousEmail, reason: "other" }).select("id")).data!;
    await moderator.client.rpc("admin_handle_report", { p_report_id: third, p_status: "in_review", p_note: "" });
    expect(await sql(`select 1 from public.email_outbox where dedupe_key like $1`, [`report_decision:${third}:%`])).toHaveLength(0);
  });
});
