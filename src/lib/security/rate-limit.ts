import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limiting backed by PostgreSQL (no paid cache service needed).
 * Returns true when the action is allowed. Fails open on infrastructure errors so
 * that a database hiccup does not lock every user out (abuse is still bounded by
 * the per-function limits enforced inside SQL).
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("rate_limit_check", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true;
  }
  return data === true;
}
