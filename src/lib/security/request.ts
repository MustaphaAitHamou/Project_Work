import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Client IP as reported by the hosting proxy (rate limits, anti-robot check).
 * - Vercel (default): it overwrites x-forwarded-for with the visitor's address.
 * - Own server behind Nginx (Iglao): CLIENT_IP_HEADER=x-real-ip, set by Nginx from the
 *   connecting address; x-forwarded-for is ignored because a visitor can prepend to it.
 */
export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers(), process.env.CLIENT_IP_HEADER);
}

export function clientIpFrom(h: Pick<Headers, "get">, header: string | undefined): string {
  if (header === "x-real-ip" || header === "cf-connecting-ip") return h.get(header)?.trim() || "0.0.0.0";
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
