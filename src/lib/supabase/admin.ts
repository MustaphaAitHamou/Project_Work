import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Service-role client. BYPASSES Row Level Security: use only in server code after
 * explicit authorisation checks (webhooks, cron jobs, validated uploads).
 */
export function createAdminClient() {
  if (client) return client;
  const e = env();
  client = createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export type AdminSupabase = ReturnType<typeof createAdminClient>;
