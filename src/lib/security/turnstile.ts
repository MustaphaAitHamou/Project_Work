import "server-only";
import { env } from "@/lib/env";
import { clientIp } from "./request";

/**
 * Verifies a Cloudflare Turnstile token for forms handled by this application
 * (e.g. anonymous reports). Auth forms pass the token to Supabase Auth instead,
 * which verifies it itself when captcha protection is enabled in Supabase.
 * When Turnstile is not configured (local development), verification is skipped.
 */
export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: await clientIp() });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    // Cloudflare's reason (e.g. timeout-or-duplicate, invalid-input-secret), never the token or key.
    if (json.success !== true) console.warn(`[captcha] application check refused: ${(json["error-codes"] ?? []).join(", ") || "unknown"}`);
    return json.success === true;
  } catch {
    console.warn("[captcha] application check: Cloudflare unreachable");
    return false;
  }
}

export function captchaEnabled(): boolean {
  return Boolean(env().TURNSTILE_SECRET_KEY && env().NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
