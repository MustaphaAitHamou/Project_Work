import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

/**
 * Verifies the token_hash sent in Supabase Auth e-mails (works across devices,
 * unlike the PKCE code flow) and opens a session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requestedLocale = searchParams.get("locale") ?? "";
  const locale = (routing.locales as readonly string[]).includes(requestedLocale) ? requestedLocale : routing.defaultLocale;
  const base = request.nextUrl.clone();
  base.search = "";

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      base.pathname = type === "recovery" ? `/${locale}/reset-password` : `/${locale}/welcome`;
      return NextResponse.redirect(base);
    }
  }
  base.pathname = `/${locale}/login`;
  base.search = "?error=link_invalid";
  return NextResponse.redirect(base);
}
