import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireEmployer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { SettingsForm } from "@/components/settings/settings-form";
import { PrivacyPanel } from "@/components/settings/privacy-panel";

export default async function EmployerSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  const [t, tp] = await Promise.all([getTranslations("settings"), getTranslations("privacy")]);
  const supabase = await createClient();
  const [{ data }, { data: requests }] = await Promise.all([
    supabase.from("users").select("locale, notify_application_updates, notify_job_alerts, notify_billing").eq("id", user.id).single(),
    supabase.from("privacy_requests").select("id, type, status, created_at, response").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  return (
    <div className="space-y-10">
      <div>
        <PageHeader title={t("title")} />
        <SettingsForm
          accountType="employer"
          values={{
            locale: data?.locale ?? locale,
            email: user.email,
            notifyApplicationUpdates: data?.notify_application_updates ?? true,
            notifyJobAlerts: data?.notify_job_alerts ?? true,
            notifyBilling: data?.notify_billing ?? true,
          }}
        />
      </div>
      <div>
        <PageHeader title={tp("title")} description={tp("description")} />
        <PrivacyPanel requests={requests ?? []} retentionMonths={24} accountType="employer" />
      </div>
    </div>
  );
}
