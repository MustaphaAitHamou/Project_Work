import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value ?? "";
  const locale = (routing.locales as readonly string[]).includes(cookieLocale) ? cookieLocale : routing.defaultLocale;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}`;
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
