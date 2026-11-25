/**
 * Back-office second factor, enforced by the database itself (app.has_permission):
 * a back-office member without a verified second factor (aal1) has no permission,
 * even when calling the API directly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, grantAdminRole, sql } from "../../helpers/supabase";
import { totp } from "../../helpers/totp";

const setRequired = (on: boolean) => sql(`update public.platform_settings set value = $1::jsonb where key = 'security.admin_mfa_required'`, [JSON.stringify(on)]);

describe("back-office second factor", () => {
  beforeAll(() => setRequired(true));
  afterAll(() => setRequired(false));

  it("grants no back-office permission without a second factor, then grants it once verified", async () => {
    const admin = await createTestUser("candidate", { firstName: "Mfa", lastName: "Admin" });
    await grantAdminRole(admin.id, "super_admin");

    expect((await admin.client.rpc("admin_mfa_status")).data).toMatchObject({ required: true, aal: "aal1" });
    expect((await admin.client.rpc("has_admin_permission", { p_permission: "settings.manage" })).data).toBe(false);
    // Row Level Security relies on the same check: non-public settings stay hidden.
    const hidden = await admin.client.from("platform_settings").select("key").eq("key", "security.admin_mfa_required");
    expect(hidden.data ?? []).toHaveLength(0);

    const enroll = await admin.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "integration test" });
    expect(enroll.error).toBeNull();
    const wrong = await admin.client.auth.mfa.challengeAndVerify({ factorId: enroll.data!.id, code: "000000" === totp(enroll.data!.totp.secret) ? "111111" : "000000" });
    expect(wrong.error).not.toBeNull();
    const verified = await admin.client.auth.mfa.challengeAndVerify({ factorId: enroll.data!.id, code: totp(enroll.data!.totp.secret) });
    expect(verified.error).toBeNull();

    expect((await admin.client.rpc("admin_mfa_status")).data).toMatchObject({ aal: "aal2" });
    expect((await admin.client.rpc("has_admin_permission", { p_permission: "settings.manage" })).data).toBe(true);
    const visible = await admin.client.from("platform_settings").select("key").eq("key", "security.admin_mfa_required");
    expect(visible.data ?? []).toHaveLength(1);
  });

  it("changes nothing for candidates and recruiters", async () => {
    const candidate = await createTestUser("candidate");
    expect((await candidate.client.rpc("admin_mfa_status")).data).toMatchObject({ required: true });
    const profile = await candidate.client.from("candidate_profiles").select("user_id").eq("user_id", candidate.id);
    expect(profile.error).toBeNull();
    expect(profile.data).toHaveLength(1);
  });
});
