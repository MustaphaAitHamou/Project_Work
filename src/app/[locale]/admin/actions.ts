"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorKey } from "@/lib/errors";
import { failure, success, type ActionState } from "@/lib/action-state";
import { assertAdminPermission } from "@/lib/admin/guard";
import { cancelSubscriptionsAtPeriodEnd } from "@/lib/billing/subscriptions";
import { refundPayment, syncPlanToStripe } from "@/lib/billing/admin-ops";
import { deleteAccount } from "@/lib/privacy/delete-account";
import { flushOutboxQuietly } from "@/lib/email/outbox";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { CURRENCIES } from "@/lib/domain";
import { routing } from "@/i18n/routing";

/*
 * Every back-office mutation runs with the administrator's own session: the SQL
 * functions re-check the permission and write the audit log atomically. The few
 * operations that need the service role (Stripe, account erasure) first verify the
 * permission through the database (assertAdminPermission).
 */

const L = (fd: FormData) => {
  const l = String(fd.get("locale") ?? "");
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
};
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const uuid = z.uuid();

/** Translated "invalid input" failure (never a raw technical string in the UI). */
async function invalid(fd: FormData): Promise<ActionState<never>> {
  return failure((await getTranslations({ locale: L(fd), namespace: "errors" }))("invalid_input"));
}

async function run(fd: FormData, fn: (sb: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: { code?: string; message?: string } | null; data?: unknown }>, revalidate: string): Promise<ActionState> {
  const locale = L(fd);
  const [t, te] = await Promise.all([getTranslations({ locale, namespace: "admin.common" }), getTranslations({ locale, namespace: "errors" })]);
  const supabase = await createClient();
  const { error, data } = await fn(supabase);
  if (error) return failure(te(errorKey(error)));
  after(flushOutboxQuietly);
  revalidatePath(`/${locale}${revalidate}`, "layout");
  return success(t("saved"), data);
}

export async function reviewCompanyAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "companyId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_review_company", { p_company_id: id, p_decision: str(fd, "decision"), p_message: str(fd, "message") || undefined, p_internal_note: str(fd, "internalNote") || undefined } as never), "/admin/companies");
}

export async function suspendCompanyAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "companyId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  const result = await run(fd, (sb) => sb.rpc("admin_set_company_suspension", { p_company_id: id, p_suspend: str(fd, "suspend") === "true", p_reason: str(fd, "reason"), p_internal_note: str(fd, "internalNote") || undefined } as never), "/admin/companies");
  const ids = (result.data as { cancel_subscription_ids?: string[] } | undefined)?.cancel_subscription_ids ?? [];
  if (result.ok && ids.length) await cancelSubscriptionsAtPeriodEnd(ids);
  return result;
}

export async function moderateJobAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "jobId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  const result = await run(fd, (sb) => sb.rpc("admin_moderate_job", { p_job_id: id, p_decision: str(fd, "decision"), p_reason: str(fd, "reason") || undefined, p_internal_note: str(fd, "internalNote") || undefined } as never), "/admin/jobs");
  const ids = (result.data as { cancel_subscription_ids?: string[] } | undefined)?.cancel_subscription_ids ?? [];
  if (result.ok && ids.length) await cancelSubscriptionsAtPeriodEnd(ids);
  return result;
}

export async function handleReportAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "reportId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_handle_report", { p_report_id: id, p_status: str(fd, "status") as never, p_note: str(fd, "note") }), "/admin/reports");
}

export async function setUserStatusAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "userId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_set_user_status", { p_user_id: id, p_status: str(fd, "status") as never, p_reason: str(fd, "reason") }), "/admin/users");
}

export async function setRoleAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "userId");
  const role = str(fd, "role");
  if (!uuid.safeParse(id).success || !(ADMIN_ROLES as readonly string[]).includes(role)) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_set_role", { p_user_id: id, p_role: role as never, p_grant: str(fd, "grant") === "true" }), "/admin/users");
}

export async function updateCountryAction(_p: ActionState, fd: FormData) {
  const code = str(fd, "code").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return invalid(fd);
  const flags = {
    is_browsable: fd.get("is_browsable") === "on",
    is_registration_open: fd.get("is_registration_open") === "on",
    is_paid_publishing_enabled: fd.get("is_paid_publishing_enabled") === "on",
    auto_verification_enabled: fd.get("auto_verification_enabled") === "on",
    compliance_status: str(fd, "compliance_status") || undefined,
    compliance_notes: str(fd, "compliance_notes"),
  };
  return run(fd, (sb) => sb.rpc("admin_update_country", { p_code: code, p: flags, p_override_justification: str(fd, "override") || undefined } as never), "/admin/countries");
}

export async function updateComplianceItemAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "itemId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_update_compliance_item", { p_id: id, p_status: str(fd, "status") as never, p_notes: str(fd, "notes"), p_evidence_url: str(fd, "evidenceUrl") || undefined } as never), "/admin/countries");
}

const planSchema = z.object({
  country: z.string().regex(/^([A-Z]{2})?$/),
  currency: z.enum(CURRENCIES),
  amount: z
    .string()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v > 0 && v <= 10000),
  taxBehavior: z.enum(["exclusive", "inclusive"]),
  notes: z.string().max(500),
});

export async function upsertPlanAction(_p: ActionState, fd: FormData) {
  const parsed = planSchema.safeParse({ country: str(fd, "country"), currency: str(fd, "currency"), amount: str(fd, "amount"), taxBehavior: str(fd, "taxBehavior"), notes: str(fd, "notes") });
  if (!parsed.success) return failure((await getTranslations({ locale: L(fd), namespace: "errors" }))("invalid_input"));
  const d = parsed.data;
  return run(fd, (sb) => sb.rpc("admin_upsert_pricing_plan", { p_country: d.country, p_currency: d.currency, p_unit_amount: Math.round(d.amount * 100), p_tax_behavior: d.taxBehavior, p_notes: d.notes || undefined } as never), "/admin/pricing");
}

export async function deactivatePlanAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "planId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_deactivate_pricing_plan", { p_plan_id: id }), "/admin/pricing");
}

export async function syncPlanAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const locale = L(fd);
  const te = await getTranslations({ locale, namespace: "errors" });
  const t = await getTranslations({ locale, namespace: "admin.common" });
  const id = str(fd, "planId");
  if (!uuid.safeParse(id).success || !(await assertAdminPermission("pricing.manage"))) return failure(te("forbidden"));
  try {
    await syncPlanToStripe(id);
  } catch (e) {
    return failure(e instanceof Error && e.message === "billing_unavailable" ? te("billing_unavailable") : te("generic"));
  }
  revalidatePath(`/${locale}/admin/pricing`);
  return success(t("saved"));
}

export async function refundAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const locale = L(fd);
  const te = await getTranslations({ locale, namespace: "errors" });
  const t = await getTranslations({ locale, namespace: "admin.payments" });
  const admin = await assertAdminPermission("payments.refund");
  const id = str(fd, "paymentId");
  const reason = str(fd, "reason");
  const amountRaw = str(fd, "amount");
  if (!admin) return failure(te("forbidden"));
  if (!uuid.safeParse(id).success || reason.length < 10) return failure(t("refundReasonRequired"));
  const amount = amountRaw ? Math.round(Number(amountRaw.replace(",", ".")) * 100) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) return failure(te("invalid_amount"));
  try {
    await refundPayment(id, amount, reason, admin.id);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return failure(m === "billing_unavailable" ? te("billing_unavailable") : m === "invalid_amount" ? te("invalid_amount") : t("refundFailed"));
  }
  revalidatePath(`/${locale}/admin/payments`);
  return success(t("refunded"));
}

export async function handlePrivacyAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "requestId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_handle_privacy_request", { p_request_id: id, p_status: str(fd, "status") as never, p_response: str(fd, "response") }), "/admin/privacy");
}

export async function eraseAccountAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const locale = L(fd);
  const te = await getTranslations({ locale, namespace: "errors" });
  const t = await getTranslations({ locale, namespace: "admin.privacy" });
  const admin = await assertAdminPermission("privacy.handle");
  const userId = str(fd, "userId");
  const requestId = str(fd, "requestId");
  if (!admin) return failure(te("forbidden"));
  if (!uuid.safeParse(userId).success || str(fd, "confirm") !== "ERASE") return failure(t("eraseConfirmRequired"));
  if (userId === admin.id) return failure(te("cannot_target_self"));
  const result = await deleteAccount(userId);
  if (!result.ok) return failure(te("generic"));
  if (uuid.safeParse(requestId).success) {
    const supabase = await createClient();
    await supabase.rpc("admin_handle_privacy_request", { p_request_id: requestId, p_status: "completed", p_response: t("erasedResponse") });
  }
  revalidatePath(`/${locale}/admin/privacy`);
  return success(t("erased"));
}

export async function upsertEmailTemplateAction(_p: ActionState, fd: FormData) {
  return run(
    fd,
    (sb) =>
      sb.rpc("admin_upsert_email_template", {
        p_template: str(fd, "template"),
        p_locale: str(fd, "templateLocale"),
        p_subject: str(fd, "subject"),
        p_body: str(fd, "body"),
        p_is_active: fd.get("isActive") === "on",
      }),
    "/admin/emails",
  );
}

export async function deleteEmailTemplateAction(_p: ActionState, fd: FormData) {
  return run(fd, (sb) => sb.rpc("admin_delete_email_template", { p_template: str(fd, "template"), p_locale: str(fd, "templateLocale") }), "/admin/emails");
}

export async function upsertModerationTermAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "termId");
  return run(
    fd,
    (sb) =>
      sb.rpc("admin_upsert_moderation_term", {
        p_id: uuid.safeParse(id).success ? id : (null as unknown as string),
        p_code: str(fd, "code"),
        p_category: str(fd, "category"),
        p_language: str(fd, "language"),
        p_pattern: str(fd, "pattern"),
        p_description: str(fd, "description"),
        p_is_active: fd.get("isActive") === "on",
      }),
    "/admin/moderation",
  );
}

export async function updateSettingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  let value: unknown;
  try {
    value = JSON.parse(str(fd, "value"));
  } catch {
    return failure((await getTranslations({ locale: L(fd), namespace: "errors" }))("invalid_input"));
  }
  return run(fd, (sb) => sb.rpc("admin_update_setting", { p_key: str(fd, "key"), p_value: value as never }), "/admin/settings");
}

/** Creates a Tamurt HQ API client. The token is shown ONCE; only its SHA-256 hash is stored. */
export async function createServiceClientAction(_p: ActionState, fd: FormData): Promise<ActionState<{ token: string }>> {
  const name = str(fd, "name");
  const ips = str(fd, "allowedIps")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (name.length < 2) return invalid(fd);
  const token = `tjhq_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  const result = await run(fd, (sb) => sb.rpc("admin_create_service_client", { p_name: name, p_token_prefix: token.slice(0, 10), p_token_hash: hash, p_scopes: ["metrics:read"], p_allowed_ips: ips }), "/admin/settings");
  if (!result.ok) return result as ActionState<{ token: string }>;
  return { ...result, data: { token } };
}

export async function revokeServiceClientAction(_p: ActionState, fd: FormData) {
  const id = str(fd, "clientId");
  if (!uuid.safeParse(id).success) return invalid(fd);
  return run(fd, (sb) => sb.rpc("admin_revoke_service_client", { p_id: id }), "/admin/settings");
}
