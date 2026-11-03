import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPublicSetting } from "@/lib/jobs/queries";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { PrivacyPanel } from "@/components/settings/privacy-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title"), robots: { index: false } };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const t = await getTranslations("privacy");
  const supabase = await createClient();
  const [{ data: requests }, retention] = await Promise.all([
    supabase.from("privacy_requests").select("id, type, status, created_at, response").eq("user_id", user.id).order("created_at", { ascending: false }),
    getPublicSetting<number>("retention.applications_months", 24),
  ]);
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <PrivacyPanel requests={requests ?? []} retentionMonths={Number(retention)} accountType="candidate" />
    </div>
  );
}
