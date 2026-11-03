import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Post-confirmation router: sends each account type to its next step. */
export default async function WelcomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (user.accountType === "candidate") redirect(`/${locale}/candidate?welcome=1`);
  const supabase = await createClient();
  const { data } = await supabase.from("company_members").select("company_id").eq("user_id", user.id).maybeSingle();
  redirect(`/${locale}/employer${data ? "" : "/onboarding"}`);
}
