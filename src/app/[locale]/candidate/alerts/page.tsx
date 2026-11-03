import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCandidate } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams, toQueryString, type SearchParams } from "@/lib/search/params";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { AlertsList, type AlertItem } from "@/components/candidate/alerts-list";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "alerts" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireCandidate(locale);
  const [t, te, countryName] = await Promise.all([getTranslations("alerts"), getTranslations("enums"), getCountryNamer()]);
  const supabase = await createClient();
  const { data } = await supabase.from("job_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const summarize = (c: SearchParams) =>
    [
      c.q && `« ${c.q} »`,
      c.city,
      c.country && countryName(c.country),
      c.remoteFrom && t("remoteFrom", { country: countryName(c.remoteFrom) }),
      c.contract?.map((x) => te(`contractType.${x}` as never)).join(", "),
      c.mode?.map((x) => te(`workMode.${x}` as never)).join(", "),
    ]
      .filter(Boolean)
      .join(" · ") || t("allJobs");
  const items: AlertItem[] = (data ?? []).map((a) => {
    const c = parseSearchParams(new URLSearchParams(toQueryString(a.criteria as SearchParams)));
    return { id: a.id, name: a.name, frequency: a.frequency, email_enabled: a.email_enabled, last_sent_at: a.last_sent_at, query: toQueryString(c), summary: summarize(c) };
  });
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <AlertsList items={items} />
    </div>
  );
}
