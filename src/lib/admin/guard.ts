import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Authoritative permission check through the database (app.permission_roles), used
 * before server-side operations that then run with the service role.
 */
export async function assertAdminPermission(permission: Permission) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_admin_permission", { p_permission: permission });
  return data === true ? user : null;
}
