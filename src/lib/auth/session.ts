import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type Permission } from "./permissions";

export interface SessionUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
  accountType: "candidate" | "employer";
  firstName: string;
  lastName: string;
  locale: string;
  status: "active" | "suspended" | "deleted";
  roles: string[];
}

/**
 * Current user (verified JWT + application profile). Cached per request.
 * Authorisation is ALSO enforced by RLS and by each database function.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const sub = claimsData?.claims?.sub;
  if (!sub) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, account_type, first_name, last_name, locale, status")
      .eq("id", sub)
      .maybeSingle(),
    supabase.from("admin_roles").select("role").eq("user_id", sub),
  ]);
  if (!profile) return null;
  const claims = claimsData.claims as Record<string, unknown>;
  const userMeta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: profile.id,
    email: profile.email,
    emailConfirmed: Boolean(userMeta.email_verified ?? claims.email_verified ?? true),
    accountType: profile.account_type,
    firstName: profile.first_name,
    lastName: profile.last_name,
    locale: profile.locale,
    status: profile.status,
    roles: (roles ?? []).map((r) => r.role),
  };
});

function loginPath(locale: string, next?: string) {
  return `/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
}

export async function requireUser(locale: string, next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginPath(locale, next));
  if (user.status !== "active") redirect(`/${locale}/account-suspended`);
  return user;
}

export async function requireCandidate(locale: string, next?: string): Promise<SessionUser> {
  const user = await requireUser(locale, next);
  if (user.accountType !== "candidate") redirect(`/${locale}/employer`);
  return user;
}

export async function requireEmployer(locale: string, next?: string): Promise<SessionUser> {
  const user = await requireUser(locale, next);
  if (user.accountType !== "employer") redirect(`/${locale}/candidate`);
  return user;
}

export async function requirePermission(locale: string, permission: Permission): Promise<SessionUser> {
  const user = await requireUser(locale, `/${locale}/admin`);
  if (!hasPermission(user.roles, permission)) redirect(`/${locale}`);
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return Boolean(user && user.roles.length > 0);
}
