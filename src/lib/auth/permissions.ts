/**
 * Back-office permission matrix. MUST stay identical to app.permission_roles()
 * in supabase/migrations/*_security_helpers.sql (the database is authoritative;
 * this copy only drives navigation and page guards). A unit test checks parity.
 */
export const ADMIN_ROLES = [
  "super_admin",
  "verification_officer",
  "moderator",
  "finance",
  "privacy_officer",
  "support",
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = {
  "dashboard.view": ["super_admin", "verification_officer", "moderator", "finance", "privacy_officer", "support"],
  "companies.view": ["super_admin", "verification_officer", "moderator", "support"],
  "companies.verify": ["super_admin", "verification_officer"],
  "jobs.view": ["super_admin", "moderator", "verification_officer", "support"],
  "jobs.moderate": ["super_admin", "moderator"],
  "reports.handle": ["super_admin", "moderator"],
  "users.view": ["super_admin", "moderator", "support", "privacy_officer"],
  "users.suspend": ["super_admin", "moderator"],
  "countries.manage": ["super_admin"],
  "pricing.manage": ["super_admin", "finance"],
  "payments.view": ["super_admin", "finance"],
  "payments.refund": ["super_admin", "finance"],
  "privacy.handle": ["super_admin", "privacy_officer"],
  "emails.manage": ["super_admin"],
  "audit.view": ["super_admin", "privacy_officer"],
  "roles.manage": ["super_admin"],
  "settings.manage": ["super_admin"],
  "service_clients.manage": ["super_admin"],
  "moderation_terms.manage": ["super_admin", "moderator"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(roles: readonly string[], permission: Permission): boolean {
  const allowed: readonly string[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}
