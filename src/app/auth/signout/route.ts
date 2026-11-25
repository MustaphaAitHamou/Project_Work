import type { NextRequest } from "next/server";
import { redirectToPath } from "@/lib/http/redirect";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value ?? "";
  const locale = (routing.locales as readonly string[]).includes(cookieLocale) ? cookieLocale : routing.defaultLocale;
  return redirectToPath(`/${locale}`, 303);
}
