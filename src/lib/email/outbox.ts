import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getEmailProvider } from "./provider";
import { buildEmail, isEmailTemplate, type TemplateOverride } from "./templates";

export interface OutboxRunResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: "no_provider" | null;
}

/**
 * Delivers pending e-mails from the transactional outbox. Safe to run
 * concurrently (rows are claimed with FOR UPDATE SKIP LOCKED). When no provider
 * is configured, nothing is claimed: e-mails stay pending (never marked sent).
 */
export async function processEmailOutbox(limit = 25): Promise<OutboxRunResult> {
  const provider = getEmailProvider();
  if (!provider) return { claimed: 0, sent: 0, failed: 0, skipped: "no_provider" };
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("email_claim_batch", { p_limit: limit });
  if (error) throw new Error(`email_claim_batch: ${error.message}`);
  const batch = rows ?? [];
  if (batch.length === 0) return { claimed: 0, sent: 0, failed: 0, skipped: null };

  const userIds = [...new Set(batch.map((r) => r.user_id).filter((x): x is string => Boolean(x)))];
  const [{ data: users }, { data: overrides }] = await Promise.all([
    userIds.length ? admin.from("users").select("id, first_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; first_name: string }[] }),
    admin.from("email_templates").select("template, locale, subject, body").eq("is_active", true),
  ]);
  const names = new Map((users ?? []).map((u) => [u.id, u.first_name]));
  const overrideMap = new Map<string, TemplateOverride>((overrides ?? []).map((o) => [`${o.template}:${o.locale}`, { subject: o.subject, body: o.body }]));

  let sent = 0;
  let failed = 0;
  for (const row of batch) {
    try {
      if (!isEmailTemplate(row.template)) throw new Error(`unknown template ${row.template}`);
      const email = buildEmail(row.template, row.locale, (row.payload ?? {}) as Record<string, unknown>, {
        siteUrl: env().NEXT_PUBLIC_SITE_URL,
        firstName: row.user_id ? names.get(row.user_id) : null,
        override: overrideMap.get(`${row.template}:${row.locale}`) ?? null,
      });
      const result = await provider.send({ to: row.to_email, ...email, replyTo: env().EMAIL_REPLY_TO });
      await admin.rpc("email_complete", { p_id: row.id, p_ok: true, p_error: "", p_provider: provider.name, p_provider_message_id: result.id ?? "" });
      sent += 1;
    } catch (e) {
      failed += 1;
      await admin.rpc("email_complete", {
        p_id: row.id,
        p_ok: false,
        p_error: e instanceof Error ? e.message : String(e),
        p_provider: provider.name,
        p_provider_message_id: "",
      });
    }
  }
  return { claimed: batch.length, sent, failed, skipped: null };
}

/** Fire-and-forget delivery attempt (used with next/server `after`). Errors are logged only. */
export async function flushOutboxQuietly() {
  try {
    await processEmailOutbox(20);
  } catch (e) {
    console.error("outbox flush failed", e);
  }
}
