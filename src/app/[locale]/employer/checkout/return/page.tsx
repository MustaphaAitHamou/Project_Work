import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireEmployer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { CheckoutStatus } from "@/components/employer/checkout-status";

export default async function CheckoutReturnPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireEmployer(locale);
  const sp = await searchParams;
  const t = await getTranslations("billing");
  const supabase = await createClient();
  const sessionId = /^cs_[A-Za-z0-9_]{8,200}$/.test(sp.session_id ?? "") ? sp.session_id! : null;
  const { data: sub } = sessionId
    ? await supabase.from("subscriptions").select("job_id, status").eq("stripe_checkout_session_id", sessionId).maybeSingle()
    : { data: null };
  const { data: job } = sub ? await supabase.from("jobs").select("id, status").eq("id", sub.job_id).maybeSingle() : { data: null };
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("returnTitle")} />
      <Card>
        <CardContent className="py-10">
          <CheckoutStatus jobId={job?.id ?? null} active={job?.status === "active"} />
        </CardContent>
      </Card>
    </div>
  );
}
