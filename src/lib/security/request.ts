import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Client IP as reported by the hosting proxy (Vercel sets x-forwarded-for / x-real-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "0.0.0.0";
}

/** Pseudonymised IP used as a rate-limit key (raw IPs are never stored). */
export async function ipKey(): Promise<string> {
  const salt = process.env.SUPABASE_SECRET_KEY?.slice(-16) ?? "tamurt";
  return createHash("sha256").update(`${salt}:${await clientIp()}`).digest("hex").slice(0, 32);
}

/** Validates an in-app redirect target ("next" parameter) to prevent open redirects. */
export function safeNextPath(next: string | null | undefined, locale: string): string | null {
  if (!next) return null;
  if (!next.startsWith(`/${locale}/`) && next !== `/${locale}`) return null;
  if (next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return null;
  return next;
}
