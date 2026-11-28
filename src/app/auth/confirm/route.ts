import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { redirectToPath } from "@/lib/http/redirect";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];
const TOKEN_HASH = /^[A-Za-z0-9_-]{8,200}$/;

function readLink(values: { get(name: string): FormDataEntryValue | null }) {
  const tokenHash = String(values.get("token_hash") ?? "");
  const type = String(values.get("type") ?? "") as EmailOtpType;
  const requested = String(values.get("locale") ?? "");
  const locale = (routing.locales as readonly string[]).includes(requested) ? requested : routing.defaultLocale;
  const valid = TOKEN_HASH.test(tokenHash) && ALLOWED_TYPES.includes(type);
  return { tokenHash, type, locale, valid };
}

/**
 * Link of the Supabase Auth e-mails (confirmation, password reset, e-mail change).
 * Mail security filters (Microsoft Defender Safe Links, antivirus, previews) open links
 * before the person does: verifying the one-time token here would use it up, and the person
 * would then land on « link expired ». The token is therefore only checked after a click on
 * the confirmation page (POST below).
 */
export async function GET(request: NextRequest) {
  const { tokenHash, type, locale, valid } = readLink(request.nextUrl.searchParams);
  if (!valid) return redirectToPath(`/${locale}/login?error=link_invalid`);
  return redirectToPath(`/${locale}/confirm?${new URLSearchParams({ token_hash: tokenHash, type })}`);
}

/** The person's click on the confirmation page: verifies the token and opens the session. */
export async function POST(request: NextRequest) {
  const { tokenHash, type, locale, valid } = readLink(await request.formData());
  // Only from our own confirmation page (another site cannot post a token in the visitor's name).
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return redirectToPath(`/${locale}/login?error=link_invalid`, 303);

  if (valid) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectToPath(type === "recovery" ? `/${locale}/reset-password` : `/${locale}/welcome`, 303);
  }
  return redirectToPath(`/${locale}/login?error=link_invalid`, 303);
}
