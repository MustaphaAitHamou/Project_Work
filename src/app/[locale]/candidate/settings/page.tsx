import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { SettingsForm } from "@/components/settings/settings-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const t = await getTranslations("settings");
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("locale, notify_application_updates, notify_job_alerts, notify_billing").eq("id", user.id).single();
  return (
    <div>
      <PageHeader title={t("title")} />
      <SettingsForm
        accountType="candidate"
        values={{
          locale: data?.locale ?? locale,
          email: user.email,
          notifyApplicationUpdates: data?.notify_application_updates ?? true,
          notifyJobAlerts: data?.notify_job_alerts ?? true,
          notifyBilling: data?.notify_billing ?? true,
        }}
      />
    </div>
  );
}
