import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const HQ_TOKEN_PATTERN = /^tjhq_[A-Za-z0-9_-]{43}$/;

export type HqAuthResult =
  | { ok: true; clientId: string; name: string; scopes: string[] }
  | { ok: false; status: 401 | 403; error: "unauthorized" | "ip_not_allowed" | "insufficient_scope" };

/**
 * Authenticates a Tamurt HQ API call: bearer token (only its SHA-256 hash is stored),
 * optional source-IP allowlist (checked in SQL) and scope.
 */
export async function authenticateHqClient(authorization: string | null, ip: string, scope: string): Promise<HqAuthResult> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!HQ_TOKEN_PATTERN.test(token)) return { ok: false, status: 401, error: "unauthorized" };
  const hash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await createAdminClient().rpc("service_client_authenticate", { p_token_hash: hash, p_ip: ip });
  if (error || !data) return { ok: false, status: 401, error: "unauthorized" };
  const client = data as { id: string; name?: string; scopes?: string[]; denied?: string };
  if (client.denied) return { ok: false, status: 403, error: "ip_not_allowed" };
  if (!client.scopes?.includes(scope)) return { ok: false, status: 403, error: "insufficient_scope" };
  return { ok: true, clientId: client.id, name: client.name ?? "", scopes: client.scopes };
}
